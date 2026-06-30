import {
  pgTable, uuid, varchar, timestamp,
  numeric, date, text, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const receivables = pgTable('cobros', {
  id:            uuid('id').primaryKey().defaultRandom(),
  usuarioId:     uuid('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  deudorNombre:  varchar('deudor_nombre', { length: 100 }).notNull(),
  concepto:      varchar('concepto', { length: 255 }).notNull(),
  montoTotal:    numeric('monto_total', { precision: 15, scale: 2 }).notNull(),
  montoPagado:   numeric('monto_pagado', { precision: 15, scale: 2 }).notNull().default('0.00'),
  moneda:        varchar('moneda', { length: 3 }).notNull().default('USD'),
  fechaPrestamo: date('fecha_prestamo').notNull(),
  fechaVencim:   date('fecha_vencimiento'),
  estado:        varchar('estado', { length: 15 }).notNull().default('pendiente'),
  notas:         text('notas'),
  creadoEn:      timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  montoCk:  check('ck_cobro_monto', sql`${t.montoTotal} > 0`),
  estadoCk: check('ck_cobro_estado', sql`${t.estado} IN ('pendiente', 'parcial', 'cobrado', 'incobrable')`),
}));

export const receivablePayments = pgTable('cobros_pagos', {
  id:       uuid('id').primaryKey().defaultRandom(),
  cobroId:  uuid('cobro_id').notNull().references(() => receivables.id, { onDelete: 'cascade' }),
  monto:    numeric('monto', { precision: 15, scale: 2 }).notNull(),
  fecha:    date('fecha').notNull(),
  nota:     varchar('nota', { length: 255 }),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  montoCk: check('ck_cobro_pago_monto', sql`${t.monto} > 0`),
}));

export const debts = pgTable('deudas', {
  id:             uuid('id').primaryKey().defaultRandom(),
  usuarioId:      uuid('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  acreedorNombre: varchar('acreedor_nombre', { length: 100 }).notNull(),
  concepto:       varchar('concepto', { length: 255 }).notNull(),
  montoTotal:     numeric('monto_total', { precision: 15, scale: 2 }).notNull(),
  montoPagado:    numeric('monto_pagado', { precision: 15, scale: 2 }).notNull().default('0.00'),
  moneda:         varchar('moneda', { length: 3 }).notNull().default('USD'),
  fechaDeuda:     date('fecha_deuda').notNull(),
  fechaVencim:    date('fecha_vencimiento'),
  estado:         varchar('estado', { length: 15 }).notNull().default('pendiente'),
  notas:          text('notas'),
  creadoEn:       timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn:  timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  montoCk:  check('ck_deuda_monto', sql`${t.montoTotal} > 0`),
  estadoCk: check('ck_deuda_estado', sql`${t.estado} IN ('pendiente', 'parcial', 'pagada')`),
}));

export const debtPayments = pgTable('deudas_pagos', {
  id:       uuid('id').primaryKey().defaultRandom(),
  deudaId:  uuid('deuda_id').notNull().references(() => debts.id, { onDelete: 'cascade' }),
  monto:    numeric('monto', { precision: 15, scale: 2 }).notNull(),
  fecha:    date('fecha').notNull(),
  nota:     varchar('nota', { length: 255 }),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  montoCk: check('ck_deuda_pago_monto', sql`${t.monto} > 0`),
}));

export type Receivable = typeof receivables.$inferSelect;
export type NewReceivable = typeof receivables.$inferInsert;
export type Debt = typeof debts.$inferSelect;
