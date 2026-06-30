import {
  pgTable, uuid, varchar, boolean, timestamp, text,
  smallint, numeric, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('usuarios', {
  id:              uuid('id').primaryKey().defaultRandom(),
  nombre:          varchar('nombre', { length: 100 }).notNull(),
  email:           varchar('email', { length: 255 }).notNull(),
  passwordHash:    varchar('password_hash', { length: 255 }).notNull(),
  avatarUrl:       varchar('avatar_url', { length: 500 }),
  timezone:        varchar('timezone', { length: 50 }).notNull().default('America/Guayaquil'),
  moneda:          varchar('moneda', { length: 3 }).notNull().default('USD'),
  modoUi:          varchar('modo_ui', { length: 10 }).notNull().default('system'),
  telegramChatId:  varchar('telegram_chat_id', { length: 50 }),
  activo:          boolean('activo').notNull().default(true),
  emailVerificado: boolean('email_verificado').notNull().default(false),
  creadoEn:        timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  ultimoLogin:     timestamp('ultimo_login', { withTimezone: true }),
}, (t) => ({
  emailIdx:  uniqueIndex('uq_usuarios_email').on(t.email),
  modoUiCk:  check('ck_usuarios_modo_ui', sql`${t.modoUi} IN ('light', 'dark', 'system')`),
}));

export const userSettings = pgTable('user_settings', {
  id:                       uuid('id').primaryKey().defaultRandom(),
  usuarioId:                uuid('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ivaPorcentaje:            numeric('iva_porcentaje', { precision: 5, scale: 2 }).notNull().default('15.00'),
  alertaPresupuestoPct:     smallint('alerta_presupuesto_pct').notNull().default(80),
  diasNotifRecurrente:      smallint('dias_notif_recurrente').notNull().default(1),
  diasNotifCorte:           smallint('dias_notif_corte').notNull().default(1),
  autoRegistrarRecurrentes: boolean('auto_registrar_recurrentes').notNull().default(true),
  cryptoUpdateIntervalMin:  smallint('crypto_update_interval_min').notNull().default(30),
  diaInicioSemana:          smallint('dia_inicio_semana').notNull().default(1),
}, (t) => ({
  usuarioIdx:    uniqueIndex('uq_user_settings_usuario').on(t.usuarioId),
  alertaPctCk:   check('ck_settings_alerta_pct', sql`${t.alertaPresupuestoPct} BETWEEN 1 AND 100`),
  ivaCk:         check('ck_settings_iva', sql`${t.ivaPorcentaje} BETWEEN 0 AND 100`),
}));

export const refreshTokens = pgTable('refresh_tokens', {
  id:        uuid('id').primaryKey().defaultRandom(),
  usuarioId: uuid('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiraEn:  timestamp('expira_en', { withTimezone: true }).notNull(),
  revocado:  boolean('revocado').notNull().default(false),
  creadoEn:  timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 500 }),
});

export const notificationPreferences = pgTable('notification_preferences', {
  id:            uuid('id').primaryKey().defaultRandom(),
  usuarioId:     uuid('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  evento:        varchar('evento', { length: 50 }).notNull(),
  canalEmail:    boolean('canal_email').notNull().default(true),
  canalTelegram: boolean('canal_telegram').notNull().default(true),
  canalPush:     boolean('canal_push').notNull().default(true),
}, (t) => ({
  usuarioEventoIdx: uniqueIndex('uq_notif_pref_usuario_evento').on(t.usuarioId, t.evento),
}));

export const fcmTokens = pgTable('fcm_tokens', {
  id:        uuid('id').primaryKey().defaultRandom(),
  usuarioId: uuid('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token:     text('token').notNull(),
  creadoEn:  timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tokenIdx: uniqueIndex('uq_fcm_tokens_token').on(t.token),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
