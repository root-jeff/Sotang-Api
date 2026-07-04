import {
  pgTable, uuid, varchar, boolean, timestamp, text,
  smallint, numeric, date, uniqueIndex, check, primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { accounts } from './accounts';

export const categories = pgTable('categorias', {
  id:        uuid('id').primaryKey().defaultRandom(),
  usuarioId: uuid('usuario_id').references(() => users.id, { onDelete: 'cascade' }),
  nombre:    varchar('nombre', { length: 100 }).notNull(),
  tipo:      varchar('tipo', { length: 10 }).notNull(),
  color:     varchar('color', { length: 7 }).notNull().default('#6366f1'),
  icono:     varchar('icono', { length: 50 }),
  activa:    boolean('activa').notNull().default(true),
  esSistema: boolean('es_sistema').notNull().default(false),
  parentId:  uuid('parent_id'),  // self-ref FK handled at DB level via migration
  orden:     smallint('orden').notNull().default(0),
}, (t) => ({
  tipoCk:     check('ck_categorias_tipo', sql`${t.tipo} IN ('ingreso', 'gasto', 'ambos')`),
  noSelfCk:   check('ck_categorias_no_self_parent', sql`${t.parentId} IS NULL OR ${t.parentId} != ${t.id}`),
}));

export const tags = pgTable('etiquetas', {
  id:        uuid('id').primaryKey().defaultRandom(),
  usuarioId: uuid('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  nombre:    varchar('nombre', { length: 50 }).notNull(),
  color:     varchar('color', { length: 7 }).notNull().default('#6366f1'),
}, (t) => ({
  usuarioNombreIdx: uniqueIndex('uq_etiquetas_usuario_nombre').on(t.usuarioId, t.nombre),
}));

export const recurringTransactions = pgTable('transacciones_recurrentes', {
  id:               uuid('id').primaryKey().defaultRandom(),
  usuarioId:        uuid('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tipo:             varchar('tipo', { length: 15 }).notNull(),
  monto:            numeric('monto', { precision: 15, scale: 2 }).notNull(),
  categoriaId:      uuid('categoria_id').notNull().references(() => categories.id, { onDelete: 'restrict' }),
  cuentaId:         uuid('cuenta_id').notNull().references(() => accounts.id, { onDelete: 'restrict' }),
  descripcion:      varchar('descripcion', { length: 500 }),
  frecuencia:       varchar('frecuencia', { length: 15 }).notNull(),
  diaMes:           smallint('dia_del_mes'),
  diaSemana:        smallint('dia_de_semana'),
  fechaInicio:      date('fecha_inicio').notNull(),
  fechaFin:         date('fecha_fin'),
  activa:           boolean('activa').notNull().default(true),
  proximaEjecucion: date('proxima_ejecucion').notNull(),
  ultimaEjecucion:  date('ultima_ejecucion'),
  // Patrón State: configured → pending → notified → executed → (pending | terminal) / cancelled
  estado:           varchar('estado', { length: 12 }).notNull().default('configured'),
  modoIva:          varchar('modo_iva', { length: 10 }).notNull().default('ninguno'),
  creadoEn:         timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  estadoCk:     check('ck_recurrentes_estado', sql`${t.estado} IN ('configured', 'pending', 'notified', 'executed', 'cancelled')`),
  modoIvaCk:    check('ck_recurrentes_modo_iva', sql`${t.modoIva} IN ('ninguno', 'incluido', 'adicional')`),
  tipoCk:       check('ck_recurrentes_tipo', sql`${t.tipo} IN ('ingreso', 'gasto')`),
  frecuenciaCk: check('ck_recurrentes_frecuencia', sql`${t.frecuencia} IN ('diaria', 'semanal', 'quincenal', 'mensual', 'anual')`),
  montoCk:      check('ck_recurrentes_monto', sql`${t.monto} > 0`),
  diaMesCk:     check('ck_recurrentes_dia_mes', sql`${t.diaMes} IS NULL OR ${t.diaMes} BETWEEN 1 AND 31`),
  diaSemCk:     check('ck_recurrentes_dia_semana', sql`${t.diaSemana} IS NULL OR ${t.diaSemana} BETWEEN 0 AND 6`),
  fechasCk:     check('ck_recurrentes_fechas', sql`${t.fechaFin} IS NULL OR ${t.fechaFin} > ${t.fechaInicio}`),
}));

export const transactions = pgTable('transacciones', {
  id:              uuid('id').primaryKey().defaultRandom(),
  usuarioId:       uuid('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tipo:            varchar('tipo', { length: 15 }).notNull(),
  monto:           numeric('monto', { precision: 15, scale: 2 }).notNull(),
  montoTotal:      numeric('monto_total', { precision: 15, scale: 2 }).notNull(),
  montoSinIva:     numeric('monto_sin_iva', { precision: 15, scale: 2 }),
  ivaMonto:        numeric('iva_monto', { precision: 15, scale: 2 }),
  // ninguno: sin IVA · incluido: monto trae IVA, se desglosa · adicional: monto es base, IVA se suma encima
  modoIva:         varchar('modo_iva', { length: 10 }).notNull().default('ninguno'),
  categoriaId:     uuid('categoria_id').notNull().references(() => categories.id, { onDelete: 'restrict' }),
  cuentaId:        uuid('cuenta_id').notNull().references(() => accounts.id, { onDelete: 'restrict' }),
  cuentaDestinoId: uuid('cuenta_destino_id').references(() => accounts.id, { onDelete: 'restrict' }),
  descripcion:     varchar('descripcion', { length: 500 }),
  fecha:           date('fecha').notNull(),
  canal:           varchar('canal', { length: 10 }).notNull().default('mobile'),
  recurrenteId:    uuid('recurrente_id').references(() => recurringTransactions.id, { onDelete: 'set null' }),
  estado:          varchar('estado', { length: 15 }).notNull().default('completada'),
  notas:           text('notas'),
  creadoEn:        timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn:   timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tipoCk:       check('ck_txn_tipo', sql`${t.tipo} IN ('ingreso', 'gasto', 'transferencia')`),
  canalCk:      check('ck_txn_canal', sql`${t.canal} IN ('web', 'mobile', 'telegram', 'email')`),
  estadoCk:     check('ck_txn_estado', sql`${t.estado} IN ('completada', 'pendiente', 'en_proceso', 'anulada')`),
  montoCk:      check('ck_txn_monto', sql`${t.monto} > 0`),
  montoTotalCk: check('ck_txn_monto_total', sql`${t.montoTotal} > 0`),
  modoIvaCk:    check('ck_txn_modo_iva', sql`${t.modoIva} IN ('ninguno', 'incluido', 'adicional')`),
  ivaTotalCk:   check('ck_txn_iva_total', sql`${t.modoIva} = 'ninguno' OR (${t.montoSinIva} + ${t.ivaMonto} = ${t.montoTotal})`),
  cuentasCk:    check('ck_txn_cuentas_distintas', sql`${t.cuentaDestinoId} IS NULL OR ${t.cuentaDestinoId} != ${t.cuentaId}`),
}));

export const transactionTags = pgTable('transacciones_etiquetas', {
  transaccionId: uuid('transaccion_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),
  etiquetaId:    uuid('etiqueta_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.transaccionId, t.etiquetaId] }),
}));

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type NewRecurringTransaction = typeof recurringTransactions.$inferInsert;
export type Tag = typeof tags.$inferSelect;
