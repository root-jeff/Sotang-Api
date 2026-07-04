import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../../core/db';
import { notificationsLog, notificationPreferences } from '../../db/schema/index';

const PreferenceBody = Type.Object({
  evento:        Type.String({ maxLength: 50, example: 'presupuesto_80' }),
  canalEmail:    Type.Optional(Type.Boolean()),
  canalTelegram: Type.Optional(Type.Boolean()),
  canalPush:     Type.Optional(Type.Boolean()),
});

export default async function notificationsRoutes(app: FastifyInstance) {
  const db = () => getDb();

  app.get('/history', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Notifications'],
      summary: 'Historial de notificaciones enviadas',
      security: [{ bearerAuth: [] }],
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 30 })),
      }),
    },
  }, async (req) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const limit = (req.query as { limit?: number }).limit ?? 30;
    const data = await db().select().from(notificationsLog)
      .where(eq(notificationsLog.usuarioId, usuarioId))
      .orderBy(desc(notificationsLog.creadoEn))
      .limit(limit);
    return { data };
  });

  app.get('/preferences', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Notifications'],
      summary: 'Preferencias de canal por tipo de evento',
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const data = await db().select().from(notificationPreferences)
      .where(eq(notificationPreferences.usuarioId, usuarioId));
    return { data };
  });

  app.patch('/preferences', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Notifications'],
      summary: 'Configurar canales para un evento (upsert)',
      description: 'Sin preferencia guardada, los tres canales están activos por defecto.',
      security: [{ bearerAuth: [] }],
      body: PreferenceBody,
    },
  }, async (req) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const body = req.body as { evento: string; canalEmail?: boolean; canalTelegram?: boolean; canalPush?: boolean };

    const [existing] = await db().select().from(notificationPreferences)
      .where(and(eq(notificationPreferences.usuarioId, usuarioId), eq(notificationPreferences.evento, body.evento)));

    if (existing) {
      const [updated] = await db().update(notificationPreferences).set({
        canalEmail:    body.canalEmail    ?? existing.canalEmail,
        canalTelegram: body.canalTelegram ?? existing.canalTelegram,
        canalPush:     body.canalPush     ?? existing.canalPush,
      }).where(eq(notificationPreferences.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db().insert(notificationPreferences).values({
      usuarioId,
      evento:        body.evento,
      canalEmail:    body.canalEmail    ?? true,
      canalTelegram: body.canalTelegram ?? true,
      canalPush:     body.canalPush     ?? true,
    }).returning();
    return created;
  });
}
