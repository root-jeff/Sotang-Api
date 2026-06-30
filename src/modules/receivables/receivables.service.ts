import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../../core/db';
import { receivables, receivablePayments, debts, debtPayments } from '../../db/schema/index';

// ── TYPES ─────────────────────────────────────────────────────────────────────

export interface CreateReceivableData {
  deudorNombre:  string;
  concepto:      string;
  montoTotal:    number;
  moneda?:       string;
  fechaPrestamo: string;
  fechaVencim?:  string;
  notas?:        string;
}

export interface CreateDebtData {
  acreedorNombre: string;
  concepto:       string;
  montoTotal:     number;
  moneda?:        string;
  fechaDeuda:     string;
  fechaVencim?:   string;
  notas?:         string;
}

export interface CreatePaymentData {
  monto: number;
  fecha: string;
  nota?: string;
}

// ── SERVICE ───────────────────────────────────────────────────────────────────

export class ReceivablesService {
  private get db() { return getDb(); }

  // ── RECEIVABLES (cobros — dinero que me deben) ───────────────────────────────

  async createReceivable(usuarioId: string, data: CreateReceivableData) {
    const [r] = await this.db.insert(receivables).values({
      usuarioId,
      deudorNombre:  data.deudorNombre,
      concepto:      data.concepto,
      montoTotal:    String(data.montoTotal),
      montoPagado:   '0.00',
      moneda:        data.moneda        ?? 'USD',
      fechaPrestamo: data.fechaPrestamo,
      fechaVencim:   data.fechaVencim,
      estado:        'pendiente',
      notas:         data.notas,
    }).returning();
    return r;
  }

  async listReceivables(usuarioId: string, estado?: string) {
    const conditions = [eq(receivables.usuarioId, usuarioId)];
    if (estado) conditions.push(eq(receivables.estado, estado as any));
    return this.db
      .select()
      .from(receivables)
      .where(and(...conditions))
      .orderBy(desc(receivables.fechaPrestamo));
  }

  async getReceivable(usuarioId: string, id: string) {
    const [r] = await this.db
      .select()
      .from(receivables)
      .where(and(eq(receivables.id, id), eq(receivables.usuarioId, usuarioId)));
    return r ?? null;
  }

  async updateReceivable(usuarioId: string, id: string, data: Partial<CreateReceivableData> & { estado?: string }) {
    const upd: Record<string, unknown> = { actualizadoEn: new Date() };
    if (data.deudorNombre  !== undefined) upd.deudorNombre  = data.deudorNombre;
    if (data.concepto      !== undefined) upd.concepto      = data.concepto;
    if (data.fechaVencim   !== undefined) upd.fechaVencim   = data.fechaVencim;
    if (data.notas         !== undefined) upd.notas         = data.notas;
    if (data.estado        !== undefined) upd.estado        = data.estado;

    const [updated] = await this.db
      .update(receivables)
      .set(upd as any)
      .where(and(eq(receivables.id, id), eq(receivables.usuarioId, usuarioId)))
      .returning();
    return updated ?? null;
  }

  async deleteReceivable(usuarioId: string, id: string) {
    const [deleted] = await this.db
      .delete(receivables)
      .where(and(eq(receivables.id, id), eq(receivables.usuarioId, usuarioId)))
      .returning({ id: receivables.id });
    return deleted ?? null;
  }

  // ── RECEIVABLE PAYMENTS ───────────────────────────────────────────────────────

  async addReceivablePayment(usuarioId: string, cobroId: string, data: CreatePaymentData) {
    const cobro = await this.getReceivable(usuarioId, cobroId);
    if (!cobro) throw new Error('RECEIVABLE_NOT_FOUND');

    return this.db.transaction(async (tx) => {
      const [payment] = await tx.insert(receivablePayments).values({
        cobroId,
        monto: String(data.monto),
        fecha: data.fecha,
        nota:  data.nota,
      }).returning();

      const nuevoMontoPagado = parseFloat(cobro.montoPagado) + data.monto;
      const montoTotal       = parseFloat(cobro.montoTotal);
      const estado = nuevoMontoPagado >= montoTotal ? 'cobrado'
        : nuevoMontoPagado > 0 ? 'parcial'
        : 'pendiente';

      await tx
        .update(receivables)
        .set({ montoPagado: String(nuevoMontoPagado), estado, actualizadoEn: new Date() })
        .where(eq(receivables.id, cobroId));

      return { payment, estado, montoPagado: String(nuevoMontoPagado) };
    });
  }

  async listReceivablePayments(usuarioId: string, cobroId: string) {
    const cobro = await this.getReceivable(usuarioId, cobroId);
    if (!cobro) throw new Error('RECEIVABLE_NOT_FOUND');
    return this.db
      .select()
      .from(receivablePayments)
      .where(eq(receivablePayments.cobroId, cobroId))
      .orderBy(desc(receivablePayments.fecha));
  }

  // ── DEBTS (deudas — dinero que debo) ──────────────────────────────────────────

  async createDebt(usuarioId: string, data: CreateDebtData) {
    const [d] = await this.db.insert(debts).values({
      usuarioId,
      acreedorNombre: data.acreedorNombre,
      concepto:       data.concepto,
      montoTotal:     String(data.montoTotal),
      montoPagado:    '0.00',
      moneda:         data.moneda     ?? 'USD',
      fechaDeuda:     data.fechaDeuda,
      fechaVencim:    data.fechaVencim,
      estado:         'pendiente',
      notas:          data.notas,
    }).returning();
    return d;
  }

  async listDebts(usuarioId: string, estado?: string) {
    const conditions = [eq(debts.usuarioId, usuarioId)];
    if (estado) conditions.push(eq(debts.estado, estado as any));
    return this.db
      .select()
      .from(debts)
      .where(and(...conditions))
      .orderBy(desc(debts.fechaDeuda));
  }

  async getDebt(usuarioId: string, id: string) {
    const [d] = await this.db
      .select()
      .from(debts)
      .where(and(eq(debts.id, id), eq(debts.usuarioId, usuarioId)));
    return d ?? null;
  }

  async updateDebt(usuarioId: string, id: string, data: Partial<CreateDebtData> & { estado?: string }) {
    const upd: Record<string, unknown> = { actualizadoEn: new Date() };
    if (data.acreedorNombre !== undefined) upd.acreedorNombre = data.acreedorNombre;
    if (data.concepto       !== undefined) upd.concepto       = data.concepto;
    if (data.fechaVencim    !== undefined) upd.fechaVencim    = data.fechaVencim;
    if (data.notas          !== undefined) upd.notas          = data.notas;
    if (data.estado         !== undefined) upd.estado         = data.estado;

    const [updated] = await this.db
      .update(debts)
      .set(upd as any)
      .where(and(eq(debts.id, id), eq(debts.usuarioId, usuarioId)))
      .returning();
    return updated ?? null;
  }

  async deleteDebt(usuarioId: string, id: string) {
    const [deleted] = await this.db
      .delete(debts)
      .where(and(eq(debts.id, id), eq(debts.usuarioId, usuarioId)))
      .returning({ id: debts.id });
    return deleted ?? null;
  }

  // ── DEBT PAYMENTS ─────────────────────────────────────────────────────────────

  async addDebtPayment(usuarioId: string, deudaId: string, data: CreatePaymentData) {
    const deuda = await this.getDebt(usuarioId, deudaId);
    if (!deuda) throw new Error('DEBT_NOT_FOUND');

    return this.db.transaction(async (tx) => {
      const [payment] = await tx.insert(debtPayments).values({
        deudaId,
        monto: String(data.monto),
        fecha: data.fecha,
        nota:  data.nota,
      }).returning();

      const nuevoMontoPagado = parseFloat(deuda.montoPagado) + data.monto;
      const montoTotal       = parseFloat(deuda.montoTotal);
      const estado = nuevoMontoPagado >= montoTotal ? 'pagada'
        : nuevoMontoPagado > 0 ? 'parcial'
        : 'pendiente';

      await tx
        .update(debts)
        .set({ montoPagado: String(nuevoMontoPagado), estado, actualizadoEn: new Date() })
        .where(eq(debts.id, deudaId));

      return { payment, estado, montoPagado: String(nuevoMontoPagado) };
    });
  }

  async listDebtPayments(usuarioId: string, deudaId: string) {
    const deuda = await this.getDebt(usuarioId, deudaId);
    if (!deuda) throw new Error('DEBT_NOT_FOUND');
    return this.db
      .select()
      .from(debtPayments)
      .where(eq(debtPayments.deudaId, deudaId))
      .orderBy(desc(debtPayments.fecha));
  }
}
