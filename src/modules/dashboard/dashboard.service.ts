import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { getDb } from '../../core/db';
import {
  accounts, transactions, budgets, goals, receivables, debts,
  assets, liabilities, recurringTransactions, categories,
} from '../../db/schema/index';
import { getCachedDashboard, setCachedDashboard } from '../../core/redis';

// Dashboard consolidado (RF-41): widgets calculados en una pasada, cache Redis TTL 5 min (RF-42)
export class DashboardService {
  private get db() { return getDb(); }

  async getDashboard(usuarioId: string) {
    const cached = await getCachedDashboard(usuarioId);
    if (cached) return { ...(cached as object), cache: true };

    const hoy = new Date();
    const y = hoy.getFullYear(), m = hoy.getMonth() + 1;
    const desde = `${y}-${String(m).padStart(2, '0')}-01`;
    const hasta = new Date(y, m, 0).toISOString().slice(0, 10);

    const [cuentas, resumenMes, presupuestos, metas, cobros, deudas, activos, pasivos, proximasRec, ultimasTxns] =
      await Promise.all([
        // Widget 1: liquidez por tipo de cuenta
        this.db.select({
          tipo: accounts.tipo,
          total: sql<string>`SUM(${accounts.saldoActual})`,
          cuentas: sql<number>`COUNT(*)`,
        }).from(accounts)
          .where(and(eq(accounts.usuarioId, usuarioId), eq(accounts.activa, true)))
          .groupBy(accounts.tipo),

        // Widget 2: balance del mes (por montoTotal)
        this.db.select({
          tipo: transactions.tipo,
          total: sql<string>`COALESCE(SUM(${transactions.montoTotal}), 0)`,
        }).from(transactions)
          .where(and(
            eq(transactions.usuarioId, usuarioId),
            eq(transactions.estado, 'completada'),
            gte(transactions.fecha, desde),
            lte(transactions.fecha, hasta),
          )).groupBy(transactions.tipo),

        // Widget 3: presupuestos con ejecución del mes
        this.db.select({
          id: budgets.id,
          nombre: budgets.nombre,
          limite: budgets.monto,
          periodo: budgets.periodo,
          categoria: categories.nombre,
          ejecutado: sql<string>`COALESCE((
            SELECT SUM(t.monto_total) FROM transacciones t
            WHERE t.usuario_id = ${usuarioId}
              AND t.categoria_id = ${budgets.categoriaId}
              AND t.tipo = 'gasto' AND t.estado = 'completada'
              AND t.fecha >= ${desde} AND t.fecha <= ${hasta}
          ), 0)`,
        }).from(budgets)
          .leftJoin(categories, eq(budgets.categoriaId, categories.id))
          .where(and(eq(budgets.usuarioId, usuarioId), eq(budgets.activo, true))),

        // Widget 4: metas de ahorro
        this.db.select({
          id: goals.id, nombre: goals.nombre,
          objetivo: goals.montoObjetivo, actual: goals.montoActual,
          fechaObjetivo: goals.fechaObjetivo, completada: goals.completada,
        }).from(goals).where(eq(goals.usuarioId, usuarioId)),

        // Widget 5: cobros pendientes
        this.db.select({ total: sql<string>`COALESCE(SUM(${receivables.montoTotal} - ${receivables.montoPagado}), 0)`, items: sql<number>`COUNT(*)` })
          .from(receivables)
          .where(and(eq(receivables.usuarioId, usuarioId), sql`${receivables.estado} IN ('pendiente', 'parcial')`)),

        // Widget 5b: deudas informales pendientes
        this.db.select({ total: sql<string>`COALESCE(SUM(${debts.montoTotal} - ${debts.montoPagado}), 0)`, items: sql<number>`COUNT(*)` })
          .from(debts)
          .where(and(eq(debts.usuarioId, usuarioId), sql`${debts.estado} IN ('pendiente', 'parcial')`)),

        // Widget 6: patrimonio — activos
        this.db.select({ total: sql<string>`COALESCE(SUM(${assets.valorActual}), 0)` })
          .from(assets).where(eq(assets.usuarioId, usuarioId)),

        // pasivos
        this.db.select({ total: sql<string>`COALESCE(SUM(${liabilities.saldoActual}), 0)` })
          .from(liabilities).where(eq(liabilities.usuarioId, usuarioId)),

        // Widget 7: próximas recurrentes
        this.db.select({
          id: recurringTransactions.id,
          descripcion: recurringTransactions.descripcion,
          monto: recurringTransactions.monto,
          proximaEjecucion: recurringTransactions.proximaEjecucion,
          estado: recurringTransactions.estado,
        }).from(recurringTransactions)
          .where(and(eq(recurringTransactions.usuarioId, usuarioId), eq(recurringTransactions.activa, true)))
          .orderBy(recurringTransactions.proximaEjecucion)
          .limit(5),

        // Widget 8: últimas transacciones
        this.db.select({
          id: transactions.id, tipo: transactions.tipo,
          descripcion: transactions.descripcion,
          montoTotal: transactions.montoTotal, fecha: transactions.fecha,
        }).from(transactions)
          .where(eq(transactions.usuarioId, usuarioId))
          .orderBy(desc(transactions.fecha), desc(transactions.creadoEn))
          .limit(8),
      ]);

    const num = (s: string | null | undefined) => Math.round(parseFloat(s ?? '0') * 100) / 100;
    const balanceMes: Record<string, number> = { ingreso: 0, gasto: 0, transferencia: 0 };
    for (const r of resumenMes) balanceMes[r.tipo] = num(r.total);

    const liquidezTotal = cuentas
      .filter(c => c.tipo !== 'tarjeta_credito')
      .reduce((s, c) => s + num(c.total), 0);
    const totalActivos = num(activos[0]?.total) + liquidezTotal;
    const totalPasivos = num(pasivos[0]?.total) + num(deudas[0]?.total);

    const data = {
      periodo: `${y}-${String(m).padStart(2, '0')}`,
      liquidez: { total: Math.round(liquidezTotal * 100) / 100, porTipo: cuentas.map(c => ({ tipo: c.tipo, total: num(c.total), cuentas: Number(c.cuentas) })) },
      balanceMes: { ...balanceMes, balance: Math.round((balanceMes.ingreso - balanceMes.gasto) * 100) / 100 },
      presupuestos: presupuestos.map(p => ({
        ...p, limite: num(p.limite), ejecutado: num(p.ejecutado),
        pct: Math.round((num(p.ejecutado) / num(p.limite)) * 100),
      })),
      metas: metas.map(g => ({
        ...g, objetivo: num(g.objetivo), actual: num(g.actual),
        pct: Math.round((num(g.actual) / num(g.objetivo)) * 100),
      })),
      cobros: { pendiente: num(cobros[0]?.total), items: Number(cobros[0]?.items ?? 0) },
      deudas: { pendiente: num(deudas[0]?.total), items: Number(deudas[0]?.items ?? 0) },
      patrimonio: {
        activos: Math.round(totalActivos * 100) / 100,
        pasivos: Math.round(totalPasivos * 100) / 100,
        neto: Math.round((totalActivos - totalPasivos) * 100) / 100,
      },
      proximasRecurrentes: proximasRec,
      ultimasTransacciones: ultimasTxns,
      cache: false,
    };

    await setCachedDashboard(usuarioId, data);
    return data;
  }
}
