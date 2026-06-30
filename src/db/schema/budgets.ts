import {
  pgTable, uuid, varchar, boolean, timestamp,
  smallint, numeric, date, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { categories } from './transactions';

export const budgets = pgTable('presupuestos', {
  id:          uuid('id').primaryKey().defaultRandom(),
  usuarioId:   uuid('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  categoriaId: uuid('categoria_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  nombre:      varchar('nombre', { length: 100 }).notNull(),
  monto:       numeric('monto', { precision: 15, scale: 2 }).notNull(),
  periodo:     varchar('periodo', { length: 10 }).notNull().default('mensual'),
  fechaInicio: date('fecha_inicio').notNull(),
  fechaFin:    date('fecha_fin'),
  activo:      boolean('activo').notNull().default(true),
  creadoEn:    timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  montoCk:   check('ck_presupuesto_monto', sql`${t.monto} > 0`),
  periodoCk: check('ck_presupuesto_periodo', sql`${t.periodo} IN ('semanal', 'mensual', 'anual')`),
}));

export const goals = pgTable('metas', {
  id:            uuid('id').primaryKey().defaultRandom(),
  usuarioId:     uuid('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  nombre:        varchar('nombre', { length: 100 }).notNull(),
  descripcion:   varchar('descripcion', { length: 500 }),
  montoObjetivo: numeric('monto_objetivo', { precision: 15, scale: 2 }).notNull(),
  montoActual:   numeric('monto_actual', { precision: 15, scale: 2 }).notNull().default('0.00'),
  moneda:        varchar('moneda', { length: 3 }).notNull().default('USD'),
  fechaObjetivo: date('fecha_objetivo'),
  completada:    boolean('completada').notNull().default(false),
  color:         varchar('color', { length: 7 }).notNull().default('#6366f1'),
  icono:         varchar('icono', { length: 50 }),
  creadoEn:      timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  objetivoCk: check('ck_meta_monto_objetivo', sql`${t.montoObjetivo} > 0`),
  actualCk:   check('ck_meta_monto_actual', sql`${t.montoActual} >= 0`),
}));

export const goalContributions = pgTable('aportes_metas', {
  id:        uuid('id').primaryKey().defaultRandom(),
  metaId:    uuid('meta_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  usuarioId: uuid('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  monto:     numeric('monto', { precision: 15, scale: 2 }).notNull(),
  nota:      varchar('nota', { length: 255 }),
  fecha:     date('fecha').notNull(),
  creadoEn:  timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  montoCk: check('ck_aporte_monto', sql`${t.monto} != 0`),
}));

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type GoalContribution = typeof goalContributions.$inferSelect;
