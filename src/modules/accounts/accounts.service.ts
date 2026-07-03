import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../../core/db";
import {
  accounts,
  cardConfigs,
  cryptoConfigs,
  savingsVirtualConfigs,
} from "../../db/schema/index";
import type { CreateAccountBodyType } from "./accounts.schema";

export class AccountsService {
  private get db() {
    return getDb();
  }

  // ── CREATE ──────────────────────────────────────────────────────────────────

  async createAccount(usuarioId: string, data: CreateAccountBodyType) {
    return this.db.transaction(async (tx) => {
      const [account] = await tx
        .insert(accounts)
        .values({
          usuarioId,
          nombre: data.nombre,
          tipo: data.tipo,
          moneda: data.moneda ?? "USD",
          saldoInicial: String(data.saldoInicial ?? 0),
          saldoActual: String(data.saldoInicial ?? 0),
          color: data.color ?? "#6366f1",
          icono: data.icono,
          incluirEnTotal: data.incluirEnTotal ?? true,
          orden: data.orden ?? 0,
          notas: data.notas,
        })
        .returning();

      // Sub-configs by type
      if (data.tipo === "tarjeta_credito" && data.tarjeta) {
        await tx.insert(cardConfigs).values({
          cuentaId: account.id,
          cupoTotal: String(data.tarjeta.cupoTotal),
          fechaCorte: data.tarjeta.fechaCorte,
          fechaPago: data.tarjeta.fechaPago,
          banco: data.tarjeta.banco,
          ultimos4: data.tarjeta.ultimos4,
          tasaInteresAnual:
            data.tarjeta.tasaInteresAnual != null
              ? String(data.tarjeta.tasaInteresAnual)
              : undefined,
          cupoGrupoId: data.tarjeta.cupoGrupoId,
        });
      }

      if (data.tipo === "cripto" && data.cripto) {
        await tx.insert(cryptoConfigs).values({
          cuentaId: account.id,
          simbolo: data.cripto.simbolo,
          coingeckoId: data.cripto.coingeckoId,
          cantidad: String(data.cripto.cantidad ?? 0),
          precioCompraPromedio:
            data.cripto.precioCompraPromedio != null
              ? String(data.cripto.precioCompraPromedio)
              : undefined,
        });
      }

      if (data.tipo === "ahorro_virtual" && data.ahorroVirtual) {
        // Verify parent account belongs to same user
        const [parent] = await tx
          .select({ id: accounts.id })
          .from(accounts)
          .where(
            and(
              eq(accounts.id, data.ahorroVirtual.cuentaPadreId),
              eq(accounts.usuarioId, usuarioId),
            ),
          );
        if (!parent) throw new Error("PARENT_NOT_FOUND");

        await tx.insert(savingsVirtualConfigs).values({
          cuentaId: account.id,
          cuentaPadreId: data.ahorroVirtual.cuentaPadreId,
        });
      }

      return account;
    });
  }

  // ── LIST ────────────────────────────────────────────────────────────────────

  async listAccounts(usuarioId: string) {
    return this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.usuarioId, usuarioId), eq(accounts.activa, true)))
      .orderBy(accounts.orden, accounts.nombre);
  }

  // ── GET ONE ─────────────────────────────────────────────────────────────────

  async getAccount(usuarioId: string, id: string) {
    const [account] = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.usuarioId, usuarioId)));
    return account ?? null;
  }

  // ── UPDATE ──────────────────────────────────────────────────────────────────

  async updateAccount(
    usuarioId: string,
    id: string,
    data: Partial<CreateAccountBodyType>,
  ) {
    const updateData: Record<string, unknown> = {};
    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.icono !== undefined) updateData.icono = data.icono;
    if (data.incluirEnTotal !== undefined)
      updateData.incluirEnTotal = data.incluirEnTotal;
    if (data.orden !== undefined) updateData.orden = data.orden;
    if (data.notas !== undefined) updateData.notas = data.notas;

    if (Object.keys(updateData).length === 0)
      return this.getAccount(usuarioId, id);

    const [updated] = await this.db
      .update(accounts)
      .set(updateData as typeof accounts.$inferInsert)
      .where(and(eq(accounts.id, id), eq(accounts.usuarioId, usuarioId)))
      .returning();
    return updated ?? null;
  }

  // ── DELETE (soft) ──────────────────────────────────────────────────────────

  async deleteAccount(usuarioId: string, id: string) {
    const [deleted] = await this.db
      .update(accounts)
      .set({ activa: false })
      .where(and(eq(accounts.id, id), eq(accounts.usuarioId, usuarioId)))
      .returning({ id: accounts.id });
    return deleted ?? null;
  }

  // ── SUMMARY ─────────────────────────────────────────────────────────────────

  async getSummary(usuarioId: string) {
    const rows = await this.db
      .select({
        tipo: accounts.tipo,
        moneda: accounts.moneda,
        saldoActual: accounts.saldoActual,
        incluirEnTotal: accounts.incluirEnTotal,
      })
      .from(accounts)
      .where(and(eq(accounts.usuarioId, usuarioId), eq(accounts.activa, true)));

    let totalUsd = 0;
    const byType: Record<string, number> = {};

    for (const row of rows) {
      const saldo = parseFloat(row.saldoActual);
      // Only USD supported for now (future: FX rates)
      if (row.incluirEnTotal && row.moneda === "USD") totalUsd += saldo;
      byType[row.tipo] = (byType[row.tipo] ?? 0) + saldo;
    }

    return {
      totalUsd: Math.round(totalUsd * 100) / 100,
      byType,
      cuentas: rows.length,
    };
  }
}
