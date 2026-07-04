import { eq, and, desc, lte } from 'drizzle-orm';
import { getDb } from '../../core/db';
import { recurringTransactions, accounts, categories } from '../../db/schema/index';
import { getState, nextOccurrence, type RecurringStateName, type RecurringContext } from './recurring-state/index';
import { TransactionsService } from './transactions.service';
import { notificationsQueue } from '../../core/redis';

export interface CreateRecurringInput {
  tipo: 'ingreso' | 'gasto';
  monto: number;
  categoriaId: string;
  cuentaId: string;
  descripcion?: string;
  frecuencia: 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'anual';
  diaMes?: number;
  diaSemana?: number;
  fechaInicio: string;
  fechaFin?: string;
  modoIva?: 'ninguno' | 'incluido' | 'adicional';
}

export class RecurringService {
  private get db() { return getDb(); }
  private txnService = new TransactionsService();

  async create(usuarioId: string, data: CreateRecurringInput) {
    const [cuenta] = await this.db.select({ id: accounts.id }).from(accounts)
      .where(and(eq(accounts.id, data.cuentaId), eq(accounts.usuarioId, usuarioId)));
    if (!cuenta) throw new Error('ACCOUNT_NOT_FOUND');

    const [cat] = await this.db.select({ id: categories.id }).from(categories)
      .where(eq(categories.id, data.categoriaId));
    if (!cat) throw new Error('CATEGORY_NOT_FOUND');

    // Nace en 'configured' y se agenda inmediatamente → 'pending' (transición del State)
    const estadoInicial = getState('configured').schedule({} as RecurringContext);

    const [rec] = await this.db.insert(recurringTransactions).values({
      usuarioId,
      tipo:             data.tipo,
      monto:            String(data.monto),
      categoriaId:      data.categoriaId,
      cuentaId:         data.cuentaId,
      descripcion:      data.descripcion,
      frecuencia:       data.frecuencia,
      diaMes:           data.diaMes,
      diaSemana:        data.diaSemana,
      fechaInicio:      data.fechaInicio,
      fechaFin:         data.fechaFin,
      proximaEjecucion: data.fechaInicio,
      estado:           estadoInicial,
      modoIva:          data.modoIva ?? 'ninguno',
      activa:           true,
    }).returning();
    return rec;
  }

  async list(usuarioId: string) {
    return this.db.select().from(recurringTransactions)
      .where(eq(recurringTransactions.usuarioId, usuarioId))
      .orderBy(desc(recurringTransactions.creadoEn));
  }

  async getOne(usuarioId: string, id: string) {
    const [rec] = await this.db.select().from(recurringTransactions)
      .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.usuarioId, usuarioId)));
    return rec ?? null;
  }

  /** cancel(): transición State válida desde cualquier estado no terminal */
  async cancel(usuarioId: string, id: string) {
    const rec = await this.getOne(usuarioId, id);
    if (!rec) return null;
    const nuevoEstado = getState(rec.estado as RecurringStateName).cancel(this.toCtx(rec));
    const [updated] = await this.db.update(recurringTransactions)
      .set({ estado: nuevoEstado, activa: false })
      .where(eq(recurringTransactions.id, id))
      .returning();
    return updated;
  }

  // ── Motor de ejecución (invocado por el worker) ────────────────────────────

  /** Recurrentes activas cuya próxima ejecución ya llegó. */
  async findDue() {
    const hoy = new Date().toISOString().slice(0, 10);
    return this.db.select().from(recurringTransactions)
      .where(and(
        eq(recurringTransactions.activa, true),
        lte(recurringTransactions.proximaEjecucion, hoy),
      ));
  }

  /** Recurrentes que vencen mañana y aún no fueron notificadas (D-1). */
  async findDueTomorrow() {
    const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    return this.db.select().from(recurringTransactions)
      .where(and(
        eq(recurringTransactions.activa, true),
        eq(recurringTransactions.estado, 'pending'),
        eq(recurringTransactions.proximaEjecucion, manana),
      ));
  }

  /** notify(): pending → notified + encola el recordatorio D-1 */
  async markNotified(id: string) {
    const [rec] = await this.db.select().from(recurringTransactions).where(eq(recurringTransactions.id, id));
    if (!rec) return null;
    const nuevoEstado = getState(rec.estado as RecurringStateName).notify(this.toCtx(rec));
    await this.db.update(recurringTransactions).set({ estado: nuevoEstado }).where(eq(recurringTransactions.id, id));
    await notificationsQueue.add('recurring.reminder', {
      usuarioId: rec.usuarioId,
      evento: 'recurrente_recordatorio',
      titulo: 'Recordatorio de pago recurrente',
      cuerpo: `Mañana se ejecuta "${rec.descripcion ?? rec.tipo}" por $${rec.monto}`,
    });
    return nuevoEstado;
  }

  /**
   * execute(): crea la transacción concreta (mismo flujo ACID + modo IVA que CU-001),
   * recalcula proximaEjecucion y transiciona executed → pending | terminal.
   * Idempotente: el jobId del worker es `${id}:${proximaEjecucion}`.
   */
  async executeOne(id: string) {
    const [rec] = await this.db.select().from(recurringTransactions).where(eq(recurringTransactions.id, id));
    if (!rec || !rec.activa) return null;

    const ctx = this.toCtx(rec);
    const estadoEjecutado = getState(rec.estado as RecurringStateName).execute(ctx); // lanza si inválido

    const txn = await this.txnService.createTransaction(rec.usuarioId, {
      tipo:        rec.tipo as 'ingreso' | 'gasto',
      monto:       parseFloat(rec.monto),
      categoriaId: rec.categoriaId,
      cuentaId:    rec.cuentaId,
      fecha:       rec.proximaEjecucion,
      descripcion: rec.descripcion ?? `Recurrente ${rec.frecuencia}`,
      modoIva:     rec.modoIva as 'ninguno' | 'incluido' | 'adicional',
      canal:       'mobile',
      recurrenteId: rec.id,
    } as any);

    const siguiente = nextOccurrence(rec.proximaEjecucion, rec.frecuencia as CreateRecurringInput['frecuencia']);
    const ctxSiguiente = { ...ctx, proximaEjecucion: siguiente };
    const estadoFinal = getState(estadoEjecutado).schedule(ctxSiguiente); // pending o executed (terminal)
    const termino = estadoFinal === 'executed';

    await this.db.update(recurringTransactions).set({
      estado:           estadoFinal,
      ultimaEjecucion:  rec.proximaEjecucion,
      proximaEjecucion: siguiente,
      activa:           !termino,
    }).where(eq(recurringTransactions.id, id));

    await notificationsQueue.add('recurring.executed', {
      usuarioId: rec.usuarioId,
      evento: 'recurrente_ejecutada',
      titulo: 'Pago recurrente ejecutado',
      cuerpo: `Se ejecutó "${rec.descripcion ?? rec.tipo}": $${txn.montoTotal}`,
    });

    return { txn, estadoFinal, termino };
  }

  private toCtx(rec: typeof recurringTransactions.$inferSelect): RecurringContext {
    return {
      id: rec.id,
      activa: rec.activa,
      proximaEjecucion: rec.proximaEjecucion,
      ultimaEjecucion: rec.ultimaEjecucion,
      fechaFin: rec.fechaFin,
      frecuencia: rec.frecuencia as RecurringContext['frecuencia'],
    };
  }
}
