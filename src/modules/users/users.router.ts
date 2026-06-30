import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { UsersService } from './users.service';

const UserSettingsResponse = Type.Object({
  id:                       Type.String({ format: 'uuid' }),
  usuarioId:                Type.String({ format: 'uuid' }),
  ivaPorcentaje:            Type.String({ example: '15.00' }),
  alertaPresupuestoPct:     Type.Number({ example: 80 }),
  diasNotifRecurrente:      Type.Number({ example: 1 }),
  diasNotifCorte:           Type.Number({ example: 1 }),
  autoRegistrarRecurrentes: Type.Boolean(),
  cryptoUpdateIntervalMin:  Type.Number({ example: 30 }),
  diaInicioSemana:          Type.Number({ example: 1, description: '0=domingo … 6=sábado' }),
}, { $id: 'UserSettingsResponse' });

const NotifPrefResponse = Type.Object({
  id:            Type.String({ format: 'uuid' }),
  evento:        Type.String({ example: 'corte_tarjeta_dia_antes' }),
  canalEmail:    Type.Boolean(),
  canalTelegram: Type.Boolean(),
  canalPush:     Type.Boolean(),
}, { $id: 'NotifPrefResponse' });

const ProfileResponse = Type.Object({
  id:              Type.String({ format: 'uuid' }),
  nombre:          Type.String(),
  email:           Type.String({ format: 'email' }),
  avatarUrl:       Type.Union([Type.String(), Type.Null()]),
  timezone:        Type.String(),
  moneda:          Type.String(),
  modoUi:          Type.String(),
  telegramChatId:  Type.Union([Type.String(), Type.Null()]),
  activo:          Type.Boolean(),
  emailVerificado: Type.Boolean(),
  creadoEn:        Type.String({ format: 'date-time' }),
  ultimoLogin:     Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  settings:        Type.Union([UserSettingsResponse, Type.Null()]),
  notificaciones:  Type.Array(NotifPrefResponse),
}, { $id: 'ProfileResponse' });

export default async function usersRoutes(app: FastifyInstance) {
  const svc = new UsersService();

  // ── GET /me ────────────────────────────────────────────────────────────────
  app.get('/me', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Users'],
      summary: 'Obtener perfil del usuario',
      description: 'Retorna el perfil completo con settings y preferencias de notificación.',
      security: [{ bearerAuth: [] }],
      response: {
        200: ProfileResponse,
        404: { $ref: 'ErrorResponse' },
      },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const profile = await svc.getProfile(usuarioId);
    if (!profile) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Usuario no encontrado' });
    return profile;
  });

  // ── PATCH /me ──────────────────────────────────────────────────────────────
  app.patch('/me', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Users'],
      summary: 'Actualizar perfil',
      description: 'Modifica nombre, timezone, modo UI, Telegram chat ID o avatar.',
      security: [{ bearerAuth: [] }],
      body: Type.Partial(Type.Object({
        nombre:         Type.String({ minLength: 2, maxLength: 100 }),
        timezone:       Type.String({ example: 'America/Guayaquil' }),
        modoUi:         Type.Union([Type.Literal('light'), Type.Literal('dark'), Type.Literal('system')]),
        telegramChatId: Type.String({ maxLength: 50 }),
        avatarUrl:      Type.String({ maxLength: 500 }),
      })),
      response: { 200: ProfileResponse },
    },
  }, async (req) => {
    const usuarioId = (req.user as { sub: string }).sub;
    return svc.updateProfile(usuarioId, req.body as any);
  });

  // ── PATCH /me/settings ─────────────────────────────────────────────────────
  app.patch('/me/settings', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Users'],
      summary: 'Actualizar configuración',
      description: `Modifica las preferencias de la aplicación:
- \`ivaPorcentaje\`: IVA local (Ecuador = 15)
- \`alertaPresupuestoPct\`: % para disparar alerta de presupuesto (default 80)
- \`diasNotifRecurrente\`: días de anticipación para notificar transacciones recurrentes
- \`diasNotifCorte\`: días antes del corte de tarjeta para notificar
- \`diaInicioSemana\`: 0=domingo, 1=lunes (default)`,
      security: [{ bearerAuth: [] }],
      body: Type.Partial(Type.Object({
        ivaPorcentaje:            Type.Number({ minimum: 0, maximum: 100, example: 15 }),
        alertaPresupuestoPct:     Type.Integer({ minimum: 1, maximum: 100, example: 80 }),
        diasNotifRecurrente:      Type.Integer({ minimum: 0, maximum: 30, example: 1 }),
        diasNotifCorte:           Type.Integer({ minimum: 0, maximum: 30, example: 1 }),
        autoRegistrarRecurrentes: Type.Boolean(),
        cryptoUpdateIntervalMin:  Type.Integer({ minimum: 5, maximum: 1440, example: 30 }),
        diaInicioSemana:          Type.Integer({ minimum: 0, maximum: 6, example: 1 }),
      })),
      response: {
        200: UserSettingsResponse,
        404: { $ref: 'ErrorResponse' },
      },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const updated = await svc.updateSettings(usuarioId, req.body as any);
    if (!updated) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Settings no encontrados' });
    return updated;
  });

  // ── PATCH /me/notifications/:evento ───────────────────────────────────────
  app.patch('/me/notifications/:evento', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Users'],
      summary: 'Actualizar preferencia de notificación',
      description: `Activa o desactiva canales de notificación por evento. Eventos disponibles:
\`recurrente_dia_antes\` · \`corte_tarjeta_dia_antes\` · \`meta_completada\` · \`meta_progreso\`
\`presupuesto_alerta\` · \`presupuesto_excedido\` · \`deuda_vencida\` · \`cuenta_cobrar_recordatorio\`
\`backup_fallido\` · \`crypto_precio_error\``,
      security: [{ bearerAuth: [] }],
      params: Type.Object({ evento: Type.String() }),
      body: Type.Partial(Type.Object({
        canalEmail:    Type.Boolean(),
        canalTelegram: Type.Boolean(),
        canalPush:     Type.Boolean(),
      })),
      response: {
        200: NotifPrefResponse,
        404: { $ref: 'ErrorResponse' },
      },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { evento } = req.params as { evento: string };
    const updated = await svc.updateNotificationPref(usuarioId, evento, req.body as any);
    if (!updated) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: `Evento '${evento}' no encontrado` });
    return updated;
  });

  // ── POST /me/fcm-tokens ────────────────────────────────────────────────────
  app.post('/me/fcm-tokens', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Users'],
      summary: 'Registrar FCM token',
      description: 'Registra un token de Firebase Cloud Messaging para notificaciones push. Llamar al iniciar la app mobile si el token cambió.',
      security: [{ bearerAuth: [] }],
      body: Type.Object({
        token: Type.String({ minLength: 10, description: 'FCM registration token de Firebase', example: 'fGxB3...' }),
      }),
      response: {
        200: Type.Object({ message: Type.String() }),
      },
    },
  }, async (req) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { token } = req.body as { token: string };
    return svc.registerFcmToken(usuarioId, token);
  });

  // ── DELETE /me/fcm-tokens ──────────────────────────────────────────────────
  app.delete('/me/fcm-tokens', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Users'],
      summary: 'Eliminar FCM token',
      description: 'Elimina un token FCM. Llamar al hacer logout en el dispositivo móvil para no recibir más notificaciones.',
      security: [{ bearerAuth: [] }],
      body: Type.Object({
        token: Type.String({ minLength: 10 }),
      }),
      response: {
        200: Type.Object({ message: Type.String() }),
        404: { $ref: 'ErrorResponse' },
      },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { token } = req.body as { token: string };
    const deleted = await svc.deleteFcmToken(usuarioId, token);
    if (!deleted) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Token no encontrado' });
    return { message: 'Token eliminado' };
  });
}
