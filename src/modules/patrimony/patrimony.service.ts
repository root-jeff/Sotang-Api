import { eq, and, desc, sum, sql } from 'drizzle-orm';
import { getDb } from '../../core/db';
import { assets, liabilities, equifaxReports } from '../../db/schema/index';

export type AssetTipo = 'inmueble' | 'vehiculo' | 'electronico' | 'inversion' | 'cripto' | 'otro';
export type LiabilityTipo = 'hipoteca' | 'prestamo_personal' | 'prestamo_auto' | 'credito_educativo' | 'otro';

export interface CreateAssetData {
  nombre:      string;
  tipo:        AssetTipo;
  valorActual: number;
  moneda?:     string;
  descripcion?: string;
  fechaAdquis?: string;
}

export interface CreateLiabilityData {
  nombre:       string;
  tipo:         LiabilityTipo;
  saldoActual:  number;
  cuotaMensual?: number;
  tasaAnual?:   number;
  fechaInicio?: string;
  fechaFin?:    string;
  entidad?:     string;
  descripcion?: string;
}

export interface CreateEquifaxReportData {
  score:          number;
  capacidadPago?: number;
  deudaTotal?:    number;
  fechaConsulta:  string;
  rawJson:        string;
}

export class PatrimonyService {
  private get db() { return getDb(); }

  // ── ASSETS ──────────────────────────────────────────────────────────────────

  async createAsset(usuarioId: string, data: CreateAssetData) {
    const [asset] = await this.db.insert(assets).values({
      usuarioId,
      nombre:      data.nombre,
      tipo:        data.tipo,
      valorActual: String(data.valorActual),
      moneda:      data.moneda      ?? 'USD',
      descripcion: data.descripcion,
      fechaAdquis: data.fechaAdquis,
    }).returning();
    return asset;
  }

  async listAssets(usuarioId: string) {
    return this.db
      .select()
      .from(assets)
      .where(eq(assets.usuarioId, usuarioId))
      .orderBy(assets.tipo, assets.nombre);
  }

  async getAsset(usuarioId: string, id: string) {
    const [a] = await this.db
      .select()
      .from(assets)
      .where(and(eq(assets.id, id), eq(assets.usuarioId, usuarioId)));
    return a ?? null;
  }

  async updateAsset(usuarioId: string, id: string, data: Partial<CreateAssetData>) {
    const upd: Record<string, unknown> = { actualizadoEn: new Date() };
    if (data.nombre      !== undefined) upd.nombre      = data.nombre;
    if (data.valorActual !== undefined) upd.valorActual = String(data.valorActual);
    if (data.descripcion !== undefined) upd.descripcion = data.descripcion;
    if (data.fechaAdquis !== undefined) upd.fechaAdquis = data.fechaAdquis;

    const [updated] = await this.db
      .update(assets)
      .set(upd as any)
      .where(and(eq(assets.id, id), eq(assets.usuarioId, usuarioId)))
      .returning();
    return updated ?? null;
  }

  async deleteAsset(usuarioId: string, id: string) {
    const [deleted] = await this.db
      .delete(assets)
      .where(and(eq(assets.id, id), eq(assets.usuarioId, usuarioId)))
      .returning({ id: assets.id });
    return deleted ?? null;
  }

  // ── LIABILITIES ──────────────────────────────────────────────────────────────

  async createLiability(usuarioId: string, data: CreateLiabilityData) {
    const [liability] = await this.db.insert(liabilities).values({
      usuarioId,
      nombre:       data.nombre,
      tipo:         data.tipo,
      saldoActual:  String(data.saldoActual),
      cuotaMensual: data.cuotaMensual != null ? String(data.cuotaMensual) : undefined,
      tasaAnual:    data.tasaAnual    != null ? String(data.tasaAnual)    : undefined,
      fechaInicio:  data.fechaInicio,
      fechaFin:     data.fechaFin,
      entidad:      data.entidad,
      descripcion:  data.descripcion,
    }).returning();
    return liability;
  }

  async listLiabilities(usuarioId: string) {
    return this.db
      .select()
      .from(liabilities)
      .where(eq(liabilities.usuarioId, usuarioId))
      .orderBy(liabilities.tipo, liabilities.nombre);
  }

  async getLiability(usuarioId: string, id: string) {
    const [l] = await this.db
      .select()
      .from(liabilities)
      .where(and(eq(liabilities.id, id), eq(liabilities.usuarioId, usuarioId)));
    return l ?? null;
  }

  async updateLiability(usuarioId: string, id: string, data: Partial<CreateLiabilityData>) {
    const upd: Record<string, unknown> = { actualizadoEn: new Date() };
    if (data.nombre       !== undefined) upd.nombre       = data.nombre;
    if (data.saldoActual  !== undefined) upd.saldoActual  = String(data.saldoActual);
    if (data.cuotaMensual !== undefined) upd.cuotaMensual = String(data.cuotaMensual);
    if (data.tasaAnual    !== undefined) upd.tasaAnual    = String(data.tasaAnual);
    if (data.entidad      !== undefined) upd.entidad      = data.entidad;
    if (data.descripcion  !== undefined) upd.descripcion  = data.descripcion;
    if (data.fechaFin     !== undefined) upd.fechaFin     = data.fechaFin;

    const [updated] = await this.db
      .update(liabilities)
      .set(upd as any)
      .where(and(eq(liabilities.id, id), eq(liabilities.usuarioId, usuarioId)))
      .returning();
    return updated ?? null;
  }

  async deleteLiability(usuarioId: string, id: string) {
    const [deleted] = await this.db
      .delete(liabilities)
      .where(and(eq(liabilities.id, id), eq(liabilities.usuarioId, usuarioId)))
      .returning({ id: liabilities.id });
    return deleted ?? null;
  }

  // ── NET WORTH SUMMARY ────────────────────────────────────────────────────────

  async getNetWorth(usuarioId: string) {
    const [assetTotals, liabilityTotals] = await Promise.all([
      this.db
        .select({ tipo: assets.tipo, total: sql<string>`COALESCE(SUM(${assets.valorActual}), 0)` })
        .from(assets)
        .where(eq(assets.usuarioId, usuarioId))
        .groupBy(assets.tipo),
      this.db
        .select({ tipo: liabilities.tipo, total: sql<string>`COALESCE(SUM(${liabilities.saldoActual}), 0)` })
        .from(liabilities)
        .where(eq(liabilities.usuarioId, usuarioId))
        .groupBy(liabilities.tipo),
    ]);

    const totalActivos  = assetTotals.reduce((s, r)  => s + parseFloat(r.total), 0);
    const totalPasivos  = liabilityTotals.reduce((s, r) => s + parseFloat(r.total), 0);
    const patrimonioNeto = totalActivos - totalPasivos;

    return {
      totalActivos:   Math.round(totalActivos   * 100) / 100,
      totalPasivos:   Math.round(totalPasivos   * 100) / 100,
      patrimonioNeto: Math.round(patrimonioNeto * 100) / 100,
      activosPorTipo:  Object.fromEntries(assetTotals.map(r  => [r.tipo,  parseFloat(r.total)])),
      pasivosPorTipo:  Object.fromEntries(liabilityTotals.map(r => [r.tipo, parseFloat(r.total)])),
      calculadoEn:    new Date().toISOString(),
    };
  }

  // ── EQUIFAX REPORTS ──────────────────────────────────────────────────────────

  async createEquifaxReport(usuarioId: string, data: CreateEquifaxReportData) {
    const [report] = await this.db.insert(equifaxReports).values({
      usuarioId,
      score:          data.score,
      capacidadPago:  data.capacidadPago != null ? String(data.capacidadPago) : undefined,
      deudaTotal:     data.deudaTotal    != null ? String(data.deudaTotal)    : undefined,
      fechaConsulta:  data.fechaConsulta,
      rawJson:        data.rawJson,
    }).returning();
    return report;
  }

  async listEquifaxReports(usuarioId: string) {
    return this.db
      .select({
        id:            equifaxReports.id,
        score:         equifaxReports.score,
        capacidadPago: equifaxReports.capacidadPago,
        deudaTotal:    equifaxReports.deudaTotal,
        fechaConsulta: equifaxReports.fechaConsulta,
        creadoEn:      equifaxReports.creadoEn,
      })
      .from(equifaxReports)
      .where(eq(equifaxReports.usuarioId, usuarioId))
      .orderBy(desc(equifaxReports.fechaConsulta));
  }
}
