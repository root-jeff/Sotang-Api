import { env } from '../../core/config';

// Patrón Adapter: un contrato único frente a proveedores con APIs incompatibles.
// Cambiar de proveedor = una clase nueva, cero cambios en el worker.

export interface NotificationPayload {
  usuarioId: string;
  titulo: string;
  cuerpo: string;
  destino?: string; // email o chatId según el canal
}

export interface INotificationProvider {
  readonly canal: 'email' | 'telegram' | 'push';
  isAvailable(): boolean;
  send(n: NotificationPayload): Promise<void>;
}

/** Resend — email transaccional vía API REST. */
export class ResendAdapter implements INotificationProvider {
  readonly canal = 'email' as const;
  isAvailable() { return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM); }
  async send(n: NotificationPayload): Promise<void> {
    if (!n.destino) throw new Error('EMAIL_DESTINO_REQUIRED');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: n.destino, subject: n.titulo, html: `<p>${n.cuerpo}</p>` }),
    });
    if (!res.ok) throw new Error(`RESEND_ERROR_${res.status}: ${await res.text()}`);
  }
}

/** Telegram — Bot API directa (sendMessage). */
export class TelegramAdapter implements INotificationProvider {
  readonly canal = 'telegram' as const;
  isAvailable() { return Boolean(env.TELEGRAM_BOT_TOKEN); }
  async send(n: NotificationPayload): Promise<void> {
    if (!n.destino) throw new Error('TELEGRAM_CHAT_ID_REQUIRED');
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: n.destino, text: `*${n.titulo}*\n${n.cuerpo}`, parse_mode: 'Markdown' }),
    });
    if (!res.ok) throw new Error(`TELEGRAM_ERROR_${res.status}: ${await res.text()}`);
  }
}

/** Push FCM — pendiente de credenciales Firebase; hoy degrada a log. */
export class FcmAdapter implements INotificationProvider {
  readonly canal = 'push' as const;
  isAvailable() { return Boolean(env.FIREBASE_CREDENTIALS_JSON); }
  async send(n: NotificationPayload): Promise<void> {
    // TODO(fase móvil): integrar firebase-admin cuando existan credenciales
    console.log(`[FCM stub] push a ${n.usuarioId}: ${n.titulo}`);
  }
}

export function buildProviders(): Map<string, INotificationProvider> {
  const providers = new Map<string, INotificationProvider>();
  for (const p of [new ResendAdapter(), new TelegramAdapter(), new FcmAdapter()]) {
    providers.set(p.canal, p);
  }
  return providers;
}
