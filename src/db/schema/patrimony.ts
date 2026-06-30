import {
  pgTable, uuid, varchar, timestamp, text,
  numeric, date, integer, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const assets = pgTable('activos', {
  id:            uuid('id').primaryKey().defaultRandom(),
  usuarioId:     uuid('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  nombre:        varchar('nombre', { length: 100 }).notNull(),
  tipo:          varchar('tipo', { length: 30 }).notNull(),
  valorActual:   numeric('valor_actual', { precision: 15, scale: 2 }).notNull(),
  moneda:        varchar('moneda', { length: 3 }).notNull().default('USD'),
  descripcion:   text('descripcion'),
  fechaAdquis:   date('fecha_adquisicion'),
  creadoEn:      timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tipoCk:  check('ck_activo_tipo', sql`${t.tipo} IN ('inmueble', 'vehiculo', 'electronico', 'inversion', 'cripto', 'otro')`),
  valorCk: check('ck_activo_valor', sql`${t.valorActual} >= 0`),
}));

export const liabilities = pgTable('pasivos', {
  id:            uuid('id').primaryKey().defaultRandom(),
  usuarioId:     uuid('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  nombre:        varchar('nombre', { length: 100 }).notNull(),
  tipo:          varchar('tipo', { length: 30 }).notNull(),
  saldoActual:   numeric('saldo_actual', { precision: 15, scale: 2 }).notNull(),
  cuotaMensual:  numeric('cuota_mensual', { precision: 15, scale: 2 }),
  tasaAnual:     numeric('tasa_anual', { precision: 6, scale: 4 }),
  fechaInicio:   date('fecha_inicio'),
  fechaFin:      date('fecha_fin'),
  entidad:       varchar('entidad', { length: 100 }),
  descripcion:   text('descripcion'),
  creadoEn:      timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tipoCk:  check('ck_pasivo_tipo', sql`${t.tipo} IN ('hipoteca', 'prestamo_personal', 'prestamo_auto', 'credito_educativo', 'otro')`),
  saldoCk: check('ck_pasivo_saldo', sql`${t.saldoActual} >= 0`),
}));

export const equifaxReports = pgTable('equifax_reportes', {
  id:            uuid('id').primaryKey().defaultRandom(),
  usuarioId:     uuid('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  score:         integer('score').notNull(),
  capacidadPago: numeric('capacidad_pago', { precision: 15, scale: 2 }),
  deudaTotal:    numeric('deuda_total', { precision: 15, scale: 2 }),
  fechaConsulta: date('fecha_consulta').notNull(),
  rawJson:       text('raw_json').notNull(),
  creadoEn:      timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  scoreCk: check('ck_equifax_score', sql`${t.score} BETWEEN 0 AND 999`),
}));

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type Liability = typeof liabilities.$inferSelect;
export type NewLiability = typeof liabilities.$inferInsert;
export type EquifaxReport = typeof equifaxReports.$inferSelect;
