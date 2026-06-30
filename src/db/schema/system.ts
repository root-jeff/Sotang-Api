import {
  pgTable, uuid, varchar, timestamp,
  text, integer, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const notificationsLog = pgTable('notifications_log', {
  id:        uuid('id').primaryKey().defaultRandom(),
  usuarioId: uuid('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  evento:    varchar('evento', { length: 50 }).notNull(),
  canal:     varchar('canal', { length: 15 }).notNull(),
  titulo:    varchar('titulo', { length: 200 }).notNull(),
  cuerpo:    text('cuerpo').notNull(),
  estado:    varchar('estado', { length: 15 }).notNull().default('enviado'),
  errorMsg:  text('error_msg'),
  creadoEn:  timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  canalCk:  check('ck_notif_canal', sql`${t.canal} IN ('email', 'telegram', 'push')`),
  estadoCk: check('ck_notif_estado', sql`${t.estado} IN ('enviado', 'fallido', 'pendiente')`),
}));

export const backupLog = pgTable('backup_log', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tipo:         varchar('tipo', { length: 20 }).notNull().default('db'),
  estado:       varchar('estado', { length: 15 }).notNull(),
  tamanioBytes: integer('tamanio_bytes'),
  driveFileId:  varchar('drive_file_id', { length: 255 }),
  errorMsg:     text('error_msg'),
  creadoEn:     timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tipoCk:   check('ck_backup_tipo', sql`${t.tipo} IN ('db', 'export')`),
  estadoCk: check('ck_backup_estado', sql`${t.estado} IN ('exitoso', 'fallido', 'en_progreso')`),
}));

export const attachments = pgTable('adjuntos', {
  id:            uuid('id').primaryKey().defaultRandom(),
  usuarioId:     uuid('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  transaccionId: uuid('transaccion_id'),
  filename:      varchar('filename', { length: 255 }).notNull(),
  mimeType:      varchar('mime_type', { length: 100 }).notNull(),
  tamanioBytes:  integer('tamanio_bytes').notNull(),
  path:          varchar('path', { length: 500 }).notNull(),
  creadoEn:      timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

export type NotificationLog = typeof notificationsLog.$inferSelect;
export type BackupLog = typeof backupLog.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
