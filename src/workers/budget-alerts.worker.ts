import { Worker, type Job } from 'bullmq';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { redis, QUEUE_NAMES, notificationsQueue, cache } from '../core/redis';
import { getDb } from '../core/db';
import { budgets, transactions, categories, userSettings } from '../db/schema/index';

interface BudgetJob {
  usuarioId: string;
  categoriaId: string;
  fecha: string; // YYYY-MM-DD de la transacción que dispara la evaluación
}

function periodRange(periodo: string, fecha: string): { desde: string; hasta: string } {
  const d = new Date(fecha + 'T00:00:00Z');
  if (periodo === 'semanal') {
    const day = (d.getUTCDay() + 6) % 7; // lunes = 0
    const desde = new Date(d); desde.setUTCDate(d.getUTCDate() - day);
    const hasta = new Date(desde); hasta.setUTCDate(desde.getUTCDate() + 6);
    return { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) };
  }
  if (periodo === 'anual') {
    return { desde: `${d.getUTCFullYear()}-01-01`, hasta: `${d.getUTCFullYear()}-12-31` };
  }
  // mensual
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { desde: `${y}-${String(m).padStart(2, '0')}-01`, hasta: `${y}-${String(m).padStart(2, '0')}-${last}` };
}

// Evalúa umbrales 80%/100% con idempotencia por periodo (clave en Redis, sin dobles alertas)
export function createBudgetAlertsWorker() {
  return new Worker<BudgetJob>(QUEUE_NAMES.budgets, async (job: Job<BudgetJob>) => {
    const db = getDb();
    const { usuarioId, categoriaId, fecha } = job.data;

    const [budget] = await db.select().from(budgets).where(and(
      eq(budgets.usuarioId, usuarioId),
      eq(budgets.categoriaId, categoriaId),
      eq(budgets.activo, true),
    ));
    if (!budget) return; // sin presupuesto para esta categoría

    const { desde, hasta } = periodRange(budget.periodo, fecha);

    // Ejecutado del periodo: SIEMPRE por monto_total (incluye el IVA adicional)
    const [row] = await db.select({ total: sql<string>`COALESCE(SUM(${transactions.montoTotal}), 0)` })
      .from(transactions)
      .where(and(
        eq(transactions.usuarioId, usuarioId),
        eq(transactions.categoriaId, categoriaId),
        eq(transactions.tipo, 'gasto'),
        eq(transactions.estado, 'completada'),
        gte(transactions.fecha, desde),
        lte(transactions.fecha, hasta),
      ));

    const ejecutado = parseFloat(row?.total ?? '0');
    const limite = parseFloat(budget.monto);
    const pct = Math.round((ejecutado / limite) * 100);

    const [settings] = await db.select({ umbral: userSettings.alertaPresupuestoPct })
      .from(userSettings).where(eq(userSettings.usuarioId, usuarioId));
    const umbralWarning = settings?.umbral ?? 80;

    const [cat] = await db.select({ nombre: categories.nombre }).from(categories)
      .where(eq(categories.id, categoriaId));
    const nombreCat = cat?.nombre ?? 'categoría';

    const alert = async (nivel: '80' | '100', titulo: string, cuerpo: string) => {
      // Idempotencia: una alerta por nivel por periodo
      const key = `budget-alert:${budget.id}:${desde}:${nivel}`;
      const first = await cache.set(key, '1', 'EX', 60 * 60 * 24 * 366, 'NX');
      if (first !== 'OK') return;
      await notificationsQueue.add('budget.alert', {
        usuarioId, evento: nivel === '100' ? 'presupuesto_100' : 'presupuesto_80', titulo, cuerpo,
      });
    };

    if (pct >= 100) {
      await alert('100', 'Presupuesto excedido',
        `"${nombreCat}" alcanzó el ${pct}% del presupuesto ${budget.periodo} ($${ejecutado.toFixed(2)} de $${limite.toFixed(2)})`);
    } else if (pct >= umbralWarning) {
      await alert('80', 'Presupuesto en riesgo',
        `"${nombreCat}" va en ${pct}% del presupuesto ${budget.periodo} ($${ejecutado.toFixed(2)} de $${limite.toFixed(2)})`);
    }
  }, { connection: redis, concurrency: 4 });
}
