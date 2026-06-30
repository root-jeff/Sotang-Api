import { eq, and, gte, lte, sum, sql } from 'drizzle-orm';
import { getDb } from '../../core/db';
import { budgets } from '../../db/schema/index';
import { transactions } from '../../db/schema/index';

export interface CreateBudgetData {
  categoriaId: string;
  nombre:      string;
  monto:       number;
  periodo?:    'semanal' | 'mensual' | 'anual';
  fechaInicio: string;
  fechaFin?:   string;
}

export class BudgetsService {
  private get db() { return getDb(); }

  async createBudget(usuarioId: string, data: CreateBudgetData) {
    const [budget] = await this.db.insert(budgets).values({
      usuarioId,
      categoriaId: data.categoriaId,
      nombre:      data.nombre,
      monto:       String(data.monto),
      periodo:     data.periodo     ?? 'mensual',
      fechaInicio: data.fechaInicio,
      fechaFin:    data.fechaFin,
      activo:      true,
    }).returning();
    return budget;
  }

  async listBudgets(usuarioId: string, incluirGasto = true) {
    const rows = await this.db
      .select()
      .from(budgets)
      .where(and(
        eq(budgets.usuarioId, usuarioId),
        eq(budgets.activo, true),
      ))
      .orderBy(budgets.fechaInicio);

    if (!incluirGasto) return rows.map(b => ({ ...b, gastoActual: '0', porcentaje: 0 }));

    // For each budget calculate current spending in its period
    const today = new Date().toISOString().slice(0, 10);
    const enriched = await Promise.all(rows.map(async (b) => {
      const [{ gastado }] = await this.db
        .select({ gastado: sql<string>`COALESCE(SUM(${transactions.monto}), 0)` })
        .from(transactions)
        .where(and(
          eq(transactions.usuarioId, usuarioId),
          eq(transactions.categoriaId, b.categoriaId),
          eq(transactions.tipo, 'gasto'),
          gte(transactions.fecha, b.fechaInicio),
          b.fechaFin ? lte(transactions.fecha, b.fechaFin) : lte(transactions.fecha, today),
        ));

      const gastoActual  = parseFloat(gastado ?? '0');
      const montoLimite  = parseFloat(b.monto);
      const porcentaje   = montoLimite > 0 ? Math.round((gastoActual / montoLimite) * 10000) / 100 : 0;
      const enAlerta     = porcentaje >= 80;
      const excedido     = porcentaje >= 100;

      return { ...b, gastoActual: String(gastoActual), porcentaje, enAlerta, excedido };
    }));

    return enriched;
  }

  async getBudget(usuarioId: string, id: string) {
    const [b] = await this.db
      .select()
      .from(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.usuarioId, usuarioId)));
    return b ?? null;
  }

  async updateBudget(usuarioId: string, id: string, data: Partial<CreateBudgetData>) {
    const updateData: Record<string, unknown> = {};
    if (data.nombre      !== undefined) updateData.nombre      = data.nombre;
    if (data.monto       !== undefined) updateData.monto       = String(data.monto);
    if (data.periodo     !== undefined) updateData.periodo     = data.periodo;
    if (data.fechaInicio !== undefined) updateData.fechaInicio = data.fechaInicio;
    if (data.fechaFin    !== undefined) updateData.fechaFin    = data.fechaFin;

    if (Object.keys(updateData).length === 0) return this.getBudget(usuarioId, id);

    const [updated] = await this.db
      .update(budgets)
      .set(updateData as typeof budgets.$inferInsert)
      .where(and(eq(budgets.id, id), eq(budgets.usuarioId, usuarioId)))
      .returning();
    return updated ?? null;
  }

  async deleteBudget(usuarioId: string, id: string) {
    const [deleted] = await this.db
      .update(budgets)
      .set({ activo: false })
      .where(and(eq(budgets.id, id), eq(budgets.usuarioId, usuarioId)))
      .returning({ id: budgets.id });
    return deleted ?? null;
  }

  async getCurrentStatus(usuarioId: string) {
    const today    = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay  = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

    const rows = await this.db
      .select()
      .from(budgets)
      .where(and(
        eq(budgets.usuarioId, usuarioId),
        eq(budgets.activo, true),
        eq(budgets.periodo, 'mensual'),
      ));

    let totalPresupuestado = 0;
    let totalGastado       = 0;
    const items = await Promise.all(rows.map(async (b) => {
      const [{ gastado }] = await this.db
        .select({ gastado: sql<string>`COALESCE(SUM(${transactions.monto}), 0)` })
        .from(transactions)
        .where(and(
          eq(transactions.usuarioId, usuarioId),
          eq(transactions.categoriaId, b.categoriaId),
          eq(transactions.tipo, 'gasto'),
          gte(transactions.fecha, firstDay),
          lte(transactions.fecha, lastDay),
        ));

      const gasto       = parseFloat(gastado ?? '0');
      const limite      = parseFloat(b.monto);
      const porcentaje  = limite > 0 ? Math.round((gasto / limite) * 10000) / 100 : 0;
      totalPresupuestado += limite;
      totalGastado       += gasto;

      return {
        id: b.id, nombre: b.nombre, categoriaId: b.categoriaId,
        monto: b.monto, gastoActual: String(gasto),
        porcentaje, enAlerta: porcentaje >= 80, excedido: porcentaje >= 100,
      };
    }));

    return {
      mes: today.toISOString().slice(0, 7),
      totalPresupuestado: Math.round(totalPresupuestado * 100) / 100,
      totalGastado:       Math.round(totalGastado       * 100) / 100,
      presupuestos: items,
    };
  }
}
