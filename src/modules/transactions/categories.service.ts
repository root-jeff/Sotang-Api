import { eq, and, or, isNull, asc } from 'drizzle-orm';
import { getDb } from '../../core/db';
import { categories } from '../../db/schema/index';

export interface CreateCategoryData {
  nombre:    string;
  tipo:      'ingreso' | 'gasto' | 'ambos';
  color?:    string;
  icono?:    string;
  parentId?: string;
  orden?:    number;
}

export class CategoriesService {
  private get db() { return getDb(); }

  async createCategory(usuarioId: string, data: CreateCategoryData) {
    // Validate parentId belongs to same user (or is a system category)
    if (data.parentId) {
      const [parent] = await this.db
        .select({ id: categories.id })
        .from(categories)
        .where(and(
          eq(categories.id, data.parentId),
          or(eq(categories.usuarioId, usuarioId), isNull(categories.usuarioId)),
        ));
      if (!parent) throw new Error('PARENT_NOT_FOUND');
    }

    const [category] = await this.db.insert(categories).values({
      usuarioId,
      nombre:    data.nombre,
      tipo:      data.tipo,
      color:     data.color   ?? '#6366f1',
      icono:     data.icono,
      parentId:  data.parentId,
      orden:     data.orden   ?? 0,
      esSistema: false,
    }).returning();

    return category;
  }

  async listCategories(usuarioId: string) {
    // Returns system categories + user's own categories
    return this.db
      .select()
      .from(categories)
      .where(and(
        eq(categories.activa, true),
        or(eq(categories.usuarioId, usuarioId), isNull(categories.usuarioId)),
      ))
      .orderBy(categories.esSistema, categories.orden, categories.nombre);
  }

  async getCategory(usuarioId: string, id: string) {
    const [cat] = await this.db
      .select()
      .from(categories)
      .where(and(
        eq(categories.id, id),
        or(eq(categories.usuarioId, usuarioId), isNull(categories.usuarioId)),
      ));
    return cat ?? null;
  }

  async updateCategory(usuarioId: string, id: string, data: Partial<CreateCategoryData>) {
    // Only user-owned categories can be modified
    const updateData: Record<string, unknown> = {};
    if (data.nombre  !== undefined) updateData.nombre  = data.nombre;
    if (data.color   !== undefined) updateData.color   = data.color;
    if (data.icono   !== undefined) updateData.icono   = data.icono;
    if (data.orden   !== undefined) updateData.orden   = data.orden;

    if (Object.keys(updateData).length === 0) return this.getCategory(usuarioId, id);

    const [updated] = await this.db
      .update(categories)
      .set(updateData as typeof categories.$inferInsert)
      .where(and(
        eq(categories.id, id),
        eq(categories.usuarioId, usuarioId),  // can't modify system categories
        eq(categories.esSistema, false),
      ))
      .returning();
    return updated ?? null;
  }

  async deleteCategory(usuarioId: string, id: string) {
    const [deleted] = await this.db
      .update(categories)
      .set({ activa: false })
      .where(and(
        eq(categories.id, id),
        eq(categories.usuarioId, usuarioId),
        eq(categories.esSistema, false),
      ))
      .returning({ id: categories.id });
    return deleted ?? null;
  }
}
