import { Worker, type Job } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import { redis, QUEUE_NAMES } from '../core/redis';
import { getDb } from '../core/db';
import { notificationsLog, notificationPreferences, users } from '../db/schema/index';
import { buildProviders, type INotificationProvider, type NotificationPayload } from './adapters/index';

interface NotificationJob {
  usuarioId: string;
  evento: string;    // ej. transaccion_creada, presupuesto_80, recurrente_ejecutada
  titulo: string;
  cuerpo: string;
}

// Patrón Observer (consumidor) + Adapter (proveedores): el worker solo conoce INotificationProvider
export function createNotificationsWorker(providers: Map<string, INotificationProvider> = buildProviders()) {
  return new Worker<NotificationJob>(QUEUE_NAMES.notifications, async (job: Job<NotificationJob>) => {
    const db = getDb();
    const { usuarioId, evento, titulo, cuerpo } = job.data;

    // Preferencias por evento (default: todos los canales activos)
    const [pref] = await db.select().from(notificationPreferences)
      .where(and(eq(notificationPreferences.usuarioId, usuarioId), eq(notificationPreferences.evento, evento)));
    const canales = {
      email:    pref?.canalEmail    ?? true,
      telegram: pref?.canalTelegram ?? true,
      push:     pref?.canalPush     ?? true,
    };

    // Destinos
    const [user] = await db.select({ email: users.email, telegramChatId: users.telegramChatId })
      .from(users).where(eq(users.id, usuarioId));
    const telegramChatId = user?.telegramChatId ?? undefined;

    for (const provider of providers.values()) {
      if (!canales[provider.canal] || !provider.isAvailable()) continue;

      const payload: NotificationPayload = {
        usuarioId, titulo, cuerpo,
        destino: provider.canal === 'email' ? user?.email : provider.canal === 'telegram' ? telegramChatId : undefined,
      };
      if ((provider.canal === 'email' || provider.canal === 'telegram') && !payload.destino) continue;

      try {
        await provider.send(payload);
        await db.insert(notificationsLog).values({ usuarioId, evento, canal: provider.canal, titulo, cuerpo, estado: 'enviado' });
      } catch (err: any) {
        await db.insert(notificationsLog).values({ usuarioId, evento, canal: provider.canal, titulo, cuerpo, estado: 'fallido', errorMsg: String(err.message ?? err).slice(0, 500) });
      }
    }
  }, { connection: redis, concurrency: 4 });
}
