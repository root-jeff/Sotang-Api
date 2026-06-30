import {
  pgTable, uuid, varchar, boolean, timestamp, text,
  smallint, numeric, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const accounts = pgTable('cuentas', {
  id:             uuid('id').primaryKey().defaultRandom(),
  usuarioId:      uuid('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  nombre:         varchar('nombre', { length: 100 }).notNull(),
  tipo:           varchar('tipo', { length: 20 }).notNull(),
  moneda:         varchar('moneda', { length: 3 }).notNull().default('USD'),
  saldoInicial:   numeric('saldo_inicial', { precision: 15, scale: 2 }).notNull().default('0.00'),
  saldoActual:    numeric('saldo_actual', { precision: 15, scale: 2 }).notNull().default('0.00'),
  color:          varchar('color', { length: 7 }).notNull().default('#6366f1'),
  icono:          varchar('icono', { length: 50 }),
  activa:         boolean('activa').notNull().default(true),
  incluirEnTotal: boolean('incluir_en_total').notNull().default(true),
  orden:          smallint('orden').notNull().default(0),
  notas:          text('notas'),
  creadoEn:       timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tipoCk: check('ck_cuentas_tipo', sql`${t.tipo} IN ('banco','tarjeta_credito','efectivo','ahorro_virtual','ahorro_cuenta','fondo_inversion','cripto')`),
}));

export const creditGroups = pgTable('cupos_grupos', {
  id:        uuid('id').primaryKey().defaultRandom(),
  usuarioId: uuid('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  nombre:    varchar('nombre', { length: 100 }).notNull(),
  cupoTotal: numeric('cupo_total', { precision: 15, scale: 2 }).notNull(),
  creadoEn:  timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const cardConfigs = pgTable('tarjetas_config', {
  id:               uuid('id').primaryKey().defaultRandom(),
  cuentaId:         uuid('cuenta_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  cupoTotal:        numeric('cupo_total', { precision: 15, scale: 2 }).notNull(),
  cupoGrupoId:      uuid('cupo_grupo_id').references(() => creditGroups.id, { onDelete: 'set null' }),
  fechaCorte:       smallint('fecha_corte').notNull(),
  fechaPago:        smallint('fecha_pago').notNull(),
  tasaInteresAnual: numeric('tasa_interes_anual', { precision: 6, scale: 4 }),
  banco:            varchar('banco', { length: 100 }),
  ultimos4:         varchar('ultimos_4', { length: 4 }),
}, (t) => ({
  cuentaIdx:     uniqueIndex('uq_tarjetas_cuenta').on(t.cuentaId),
  fechaCorteCk:  check('ck_tarjetas_fecha_corte', sql`${t.fechaCorte} BETWEEN 1 AND 31`),
  fechaPagoCk:   check('ck_tarjetas_fecha_pago', sql`${t.fechaPago} BETWEEN 1 AND 31`),
}));

export const cryptoConfigs = pgTable('cripto_config', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  cuentaId:             uuid('cuenta_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  simbolo:              varchar('simbolo', { length: 20 }).notNull(),
  coingeckoId:          varchar('coingecko_id', { length: 100 }).notNull(),
  cantidad:             numeric('cantidad', { precision: 24, scale: 8 }).notNull().default('0'),
  precioCompraPromedio: numeric('precio_compra_promedio', { precision: 18, scale: 8 }),
  precioActualUsd:      numeric('precio_actual_usd', { precision: 18, scale: 8 }),
  precioDesactualizado: boolean('precio_desactualizado').notNull().default(false),
  ultimaActualizacion:  timestamp('ultima_actualizacion', { withTimezone: true }),
}, (t) => ({
  cuentaIdx:    uniqueIndex('uq_cripto_config_cuenta').on(t.cuentaId),
  cantidadCk:   check('ck_cripto_cantidad', sql`${t.cantidad} >= 0`),
}));

export const savingsVirtualConfigs = pgTable('ahorro_virtual_config', {
  id:            uuid('id').primaryKey().defaultRandom(),
  cuentaId:      uuid('cuenta_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  cuentaPadreId: uuid('cuenta_padre_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
}, (t) => ({
  cuentaIdx: uniqueIndex('uq_ahorro_virtual_cuenta').on(t.cuentaId),
  noSelfCk:  check('ck_ahorro_virtual_no_self', sql`${t.cuentaId} != ${t.cuentaPadreId}`),
}));

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type CardConfig = typeof cardConfigs.$inferSelect;
export type CryptoConfig = typeof cryptoConfigs.$inferSelect;
export type CreditGroup = typeof creditGroups.$inferSelect;
