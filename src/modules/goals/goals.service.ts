import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../../core/db';
import { goals, goalContributions } from '../../db/schema/index';

export interface CreateGoalData {
  nombre:        string;
  descripcion?:  string;
  montoObjetivo: number;
  moneda?:       string;
  fechaObjetivo?: string;
  color?:        string;
  icono?:        string;
}

export interface CreateContributionData {
  monto: number;
  nota?:  string;
  fecha:  string;
}

export class GoalsService {
  private get db() { return getDb(); }

  // ── CREATE ──────────────────────────────────────────────────────────────────

  async createGoal(usuarioId: string, data: CreateGoalData) {
    const [goal] = await this.db.insert(goals).values({
      usuarioId,
      nombre:        data.nombre,
      descripcion:   data.descripcion,
      montoObjetivo: String(data.montoObjetivo),
      montoActual:   '0.00',
      moneda:        data.moneda        ?? 'USD',
      fechaObjetivo: data.fechaObjetivo,
      color:         data.color         ?? '#6366f1',
      icono:         data.icono,
      completada:    false,
    }).returning();
    return this.enrichGoal(goal);
  }

  // ── LIST ────────────────────────────────────────────────────────────────────

  async listGoals(usuarioId: string) {
    const rows = await this.db
      .select()
      .from(goals)
      .where(eq(goals.usuarioId, usuarioId))
      .orderBy(goals.completada, desc(goals.creadoEn));
    return rows.map(g => this.enrichGoal(g));
  }

  // ── GET ONE ─────────────────────────────────────────────────────────────────

  async getGoal(usuarioId: string, id: string) {
    const [goal] = await this.db
      .select()
      .from(goals)
      .where(and(eq(goals.id, id), eq(goals.usuarioId, usuarioId)));
    return goal ? this.enrichGoal(goal) : null;
  }

  // ── UPDATE ──────────────────────────────────────────────────────────────────

  async updateGoal(usuarioId: string, id: string, data: Partial<CreateGoalData>) {
    const updateData: Record<string, unknown> = {};
    if (data.nombre        !== undefined) updateData.nombre        = data.nombre;
    if (data.descripcion   !== undefined) updateData.descripcion   = data.descripcion;
    if (data.montoObjetivo !== undefined) updateData.montoObjetivo = String(data.montoObjetivo);
    if (data.fechaObjetivo !== undefined) updateData.fechaObjetivo = data.fechaObjetivo;
    if (data.color         !== undefined) updateData.color         = data.color;
    if (data.icono         !== undefined) updateData.icono         = data.icono;

    if (Object.keys(updateData).length === 0) return this.getGoal(usuarioId, id);

    updateData.actualizadoEn = new Date();

    const [updated] = await this.db
      .update(goals)
      .set(updateData as typeof goals.$inferInsert)
      .where(and(eq(goals.id, id), eq(goals.usuarioId, usuarioId)))
      .returning();
    return updated ? this.enrichGoal(updated) : null;
  }

  // ── DELETE ──────────────────────────────────────────────────────────────────

  async deleteGoal(usuarioId: string, id: string) {
    const [deleted] = await this.db
      .delete(goals)
      .where(and(eq(goals.id, id), eq(goals.usuarioId, usuarioId)))
      .returning({ id: goals.id });
    return deleted ?? null;
  }

  // ── ADD CONTRIBUTION ────────────────────────────────────────────────────────

  async addContribution(usuarioId: string, metaId: string, data: CreateContributionData) {
    const [goal] = await this.db
      .select()
      .from(goals)
      .where(and(eq(goals.id, metaId), eq(goals.usuarioId, usuarioId)));

    if (!goal) throw new Error('GOAL_NOT_FOUND');

    return this.db.transaction(async (tx) => {
      const [contribution] = await tx.insert(goalContributions).values({
        metaId,
        usuarioId,
        monto: String(data.monto),
        nota:  data.nota,
        fecha: data.fecha,
      }).returning();

      // Update montoActual and check if completed
      const nuevoMonto = parseFloat(goal.montoActual) + data.monto;
      const completada = nuevoMonto >= parseFloat(goal.montoObjetivo);

      await tx
        .update(goals)
        .set({
          montoActual:   String(Math.max(0, nuevoMonto)),
          completada,
          actualizadoEn: new Date(),
        })
        .where(eq(goals.id, metaId));

      return { contribution, completada, montoActual: String(Math.max(0, nuevoMonto)) };
    });
  }

  // ── LIST CONTRIBUTIONS ──────────────────────────────────────────────────────

  async listContributions(usuarioId: string, metaId: string) {
    // Verify ownership
    const [goal] = await this.db
      .select({ id: goals.id })
      .from(goals)
      .where(and(eq(goals.id, metaId), eq(goals.usuarioId, usuarioId)));
    if (!goal) throw new Error('GOAL_NOT_FOUND');

    return this.db
      .select()
      .from(goalContributions)
      .where(eq(goalContributions.metaId, metaId))
      .orderBy(desc(goalContributions.fecha));
  }

  // ── ENRICH ─────────────────────────────────────────────────────────────────

  private enrichGoal(goal: typeof goals.$inferSelect) {
    const actual   = parseFloat(goal.montoActual);
    const objetivo = parseFloat(goal.montoObjetivo);
    const porcentaje = objetivo > 0 ? Math.round((actual / objetivo) * 10000) / 100 : 0;

    let diasRestantes: number | null = null;
    if (goal.fechaObjetivo && !goal.completada) {
      const hoy    = new Date();
      const target = new Date(goal.fechaObjetivo);
      diasRestantes = Math.ceil((target.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    }

    return { ...goal, porcentaje, diasRestantes };
  }
}
