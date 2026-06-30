import { eq, and, gte, lte, desc, sql, count, inArray } from 'drizzle-orm';
import { getDb } from '../../core/db';
import {
  transactions, transactionTags, accounts, categories,
} from '../../db/schema/index';
import type { CreateTransactionBodyType, ListTransactionsQueryType } from './transactions.schema';

const IVA_RATE = 0.15;

export class TransactionsService {
  private get db() { return getDb(); }

  // ── CREATE ──────────────────────────────────────────────────────────────────

  async createTransaction(usuarioId: string, data: CreateTransactionBodyType) {
    // Validate cuenta belongs to user
    const [cuenta] = await this.db
      .select({ id: accounts.id, saldoActual: accounts.saldoActual })
      .from(accounts)
      .where(and(eq(accounts.id, data.cuentaId), eq(accounts.usuarioId, usuarioId)));
    if (!cuenta) throw new Error('ACCOUNT_NOT_FOUND');

    // Validate cuentaDestino for transfers
    let cuentaDestino: { id: string; saldoActual: string } | undefined;
    if (data.tipo === 'transferencia') {
      if (!data.cuentaDestinoId) throw new Error('TRANSFER_NEEDS_DEST');
      const [dest] = await this.db
        .select({ id: accounts.id, saldoActual: accounts.saldoActual })
        .from(accounts)
        .where(and(eq(accounts.id, data.cuentaDestinoId), eq(accounts.usuarioId, usuarioId)));
      if (!dest) throw new Error('DEST_ACCOUNT_NOT_FOUND');
      cuentaDestino = dest;
    }

    // Compute IVA breakdown
    let montoSinIva: string | null = null;
    let ivaMonto: string | null = null;
    if (data.incluyeIva) {
      const sinIva = data.monto / (1 + IVA_RATE);
      const iva    = data.monto - sinIva;
      montoSinIva  = sinIva.toFixed(2);
      ivaMonto     = iva.toFixed(2);
    }

    return this.db.transaction(async (tx) => {
      const [txn] = await tx.insert(transactions).values({
        usuarioId,
        tipo:            data.tipo,
        monto:           String(data.monto),
        montoSinIva,
        ivaMonto,
        incluyeIva:      data.incluyeIva ?? false,
        categoriaId:     data.categoriaId,
        cuentaId:        data.cuentaId,
        cuentaDestinoId: data.cuentaDestinoId,
        descripcion:     data.descripcion,
        fecha:           data.fecha,
        canal:           data.canal ?? 'mobile',
        estado:          data.estado ?? 'completada',
        notas:           data.notas,
      }).returning();

      // Attach tags
      if (data.etiquetas && data.etiquetas.length > 0) {
        await tx.insert(transactionTags).values(
          data.etiquetas.map(etiquetaId => ({ transaccionId: txn.id, etiquetaId })),
        );
      }

      // Update account balances (only for completada)
      if (txn.estado === 'completada') {
        await this.applyBalanceDelta(tx, data.cuentaId, data.monto, data.tipo === 'ingreso' ? '+' : '-');
        if (data.tipo === 'transferencia' && data.cuentaDestinoId) {
          await this.applyBalanceDelta(tx, data.cuentaDestinoId, data.monto, '+');
        }
      }

      return txn;
    });
  }

  // ── LIST (paginated + filtered) ─────────────────────────────────────────────

  async listTransactions(usuarioId: string, query: ListTransactionsQueryType) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 30;
    const offset = (page - 1) * limit;

    const conditions = [eq(transactions.usuarioId, usuarioId)];
    if (query.tipo)        conditions.push(eq(transactions.tipo,        query.tipo as any));
    if (query.cuentaId)    conditions.push(eq(transactions.cuentaId,    query.cuentaId));
    if (query.categoriaId) conditions.push(eq(transactions.categoriaId, query.categoriaId));
    if (query.estado)      conditions.push(eq(transactions.estado,      query.estado as any));
    if (query.desde)       conditions.push(gte(transactions.fecha,      query.desde));
    if (query.hasta)       conditions.push(lte(transactions.fecha,      query.hasta));

    const where = and(...conditions);

    const [data, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(transactions)
        .where(where)
        .orderBy(desc(transactions.fecha), desc(transactions.creadoEn))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(transactions)
        .where(where),
    ]);

    return { data, total: Number(total), page, limit, pages: Math.ceil(Number(total) / limit) };
  }

  // ── GET ONE ─────────────────────────────────────────────────────────────────

  async getTransaction(usuarioId: string, id: string) {
    const [txn] = await this.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.usuarioId, usuarioId)));
    return txn ?? null;
  }

  // ── UPDATE ──────────────────────────────────────────────────────────────────

  async updateTransaction(usuarioId: string, id: string, data: Partial<CreateTransactionBodyType>) {
    // Fetch current to handle balance reversal if needed
    const current = await this.getTransaction(usuarioId, id);
    if (!current) return null;

    const updateData: Record<string, unknown> = { actualizadoEn: new Date() };
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
    if (data.notas       !== undefined) updateData.notas       = data.notas;
    if (data.fecha       !== undefined) updateData.fecha       = data.fecha;
    if (data.estado      !== undefined) updateData.estado      = data.estado;

    return this.db.transaction(async (tx) => {
      // If estado changed from completada → anulada, reverse balance
      if (data.estado && current.estado === 'completada' && data.estado === 'anulada') {
        const reverseOp = current.tipo === 'ingreso' ? '-' : '+';
        await this.applyBalanceDelta(tx, current.cuentaId, parseFloat(current.monto), reverseOp);
        if (current.tipo === 'transferencia' && current.cuentaDestinoId) {
          await this.applyBalanceDelta(tx, current.cuentaDestinoId, parseFloat(current.monto), '-');
        }
      }

      const [updated] = await tx
        .update(transactions)
        .set(updateData as any)
        .where(and(eq(transactions.id, id), eq(transactions.usuarioId, usuarioId)))
        .returning();
      return updated ?? null;
    });
  }

  // ── DELETE ──────────────────────────────────────────────────────────────────

  async deleteTransaction(usuarioId: string, id: string) {
    const current = await this.getTransaction(usuarioId, id);
    if (!current) return null;

    return this.db.transaction(async (tx) => {
      // Reverse balance if completada
      if (current.estado === 'completada') {
        const reverseOp = current.tipo === 'ingreso' ? '-' : '+';
        await this.applyBalanceDelta(tx, current.cuentaId, parseFloat(current.monto), reverseOp);
        if (current.tipo === 'transferencia' && current.cuentaDestinoId) {
          await this.applyBalanceDelta(tx, current.cuentaDestinoId, parseFloat(current.monto), '-');
        }
      }

      const [deleted] = await tx
        .delete(transactions)
        .where(and(eq(transactions.id, id), eq(transactions.usuarioId, usuarioId)))
        .returning({ id: transactions.id });
      return deleted ?? null;
    });
  }

  // ── SUMMARY ─────────────────────────────────────────────────────────────────

  async getMonthlySummary(usuarioId: string, year: number, month: number) {
    const desde = `${year}-${String(month).padStart(2, '0')}-01`;
    const hasta = new Date(year, month, 0).toISOString().slice(0, 10); // last day of month

    const rows = await this.db
      .select({
        tipo:  transactions.tipo,
        total: sql<string>`SUM(${transactions.monto})`,
      })
      .from(transactions)
      .where(and(
        eq(transactions.usuarioId, usuarioId),
        eq(transactions.estado, 'completada'),
        gte(transactions.fecha, desde),
        lte(transactions.fecha, hasta),
      ))
      .groupBy(transactions.tipo);

    const summary: Record<string, number> = { ingreso: 0, gasto: 0, transferencia: 0 };
    for (const r of rows) summary[r.tipo] = parseFloat(r.total ?? '0');

    return {
      periodo: `${year}-${String(month).padStart(2, '0')}`,
      ingreso:       Math.round(summary.ingreso       * 100) / 100,
      gasto:         Math.round(summary.gasto         * 100) / 100,
      transferencia: Math.round(summary.transferencia * 100) / 100,
      balance:       Math.round((summary.ingreso - summary.gasto) * 100) / 100,
    };
  }

  // ── HELPERS ─────────────────────────────────────────────────────────────────

  private async applyBalanceDelta(tx: any, cuentaId: string, monto: number, op: '+' | '-') {
    await tx
      .update(accounts)
      .set({
        saldoActual: op === '+'
          ? sql`${accounts.saldoActual} + ${monto}`
          : sql`${accounts.saldoActual} - ${monto}`,
      })
      .where(eq(accounts.id, cuentaId));
  }
}
