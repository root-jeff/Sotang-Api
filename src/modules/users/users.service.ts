import { eq, and } from 'drizzle-orm';
import { getDb } from '../../core/db';
import {
  users, userSettings, notificationPreferences, fcmTokens,
} from '../../db/schema/index';

export class UsersService {
  private get db() { return getDb(); }

  // ── PROFILE ─────────────────────────────────────────────────────────────────

  async getProfile(usuarioId: string) {
    const [user] = await this.db
      .select({
        id:              users.id,
        nombre:          users.nombre,
        email:           users.email,
        avatarUrl:       users.avatarUrl,
        timezone:        users.timezone,
        moneda:          users.moneda,
        modoUi:          users.modoUi,
        telegramChatId:  users.telegramChatId,
        activo:          users.activo,
        emailVerificado: users.emailVerificado,
        creadoEn:        users.creadoEn,
        ultimoLogin:     users.ultimoLogin,
      })
      .from(users)
      .where(eq(users.id, usuarioId));

    if (!user) return null;

    const [settings] = await this.db
      .select()
      .from(userSettings)
      .where(eq(userSettings.usuarioId, usuarioId));

    const notifPrefs = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.usuarioId, usuarioId));

    return { ...user, settings: settings ?? null, notificaciones: notifPrefs };
  }

  async updateProfile(usuarioId: string, data: {
    nombre?:         string;
    timezone?:       string;
    modoUi?:         'light' | 'dark' | 'system';
    telegramChatId?: string;
    avatarUrl?:      string;
  }) {
    const updateData: Record<string, unknown> = {};
    if (data.nombre        !== undefined) updateData.nombre        = data.nombre;
    if (data.timezone      !== undefined) updateData.timezone      = data.timezone;
    if (data.modoUi        !== undefined) updateData.modoUi        = data.modoUi;
    if (data.telegramChatId !== undefined) updateData.telegramChatId = data.telegramChatId;
    if (data.avatarUrl     !== undefined) updateData.avatarUrl     = data.avatarUrl;

    if (Object.keys(updateData).length === 0) return this.getProfile(usuarioId);

    await this.db
      .update(users)
      .set(updateData as any)
      .where(eq(users.id, usuarioId));

    return this.getProfile(usuarioId);
  }

  // ── SETTINGS ────────────────────────────────────────────────────────────────

  async updateSettings(usuarioId: string, data: {
    ivaPorcentaje?:            number;
    alertaPresupuestoPct?:     number;
    diasNotifRecurrente?:      number;
    diasNotifCorte?:           number;
    autoRegistrarRecurrentes?: boolean;
    cryptoUpdateIntervalMin?:  number;
    diaInicioSemana?:          number;
  }) {
    const updateData: Record<string, unknown> = {};
    if (data.ivaPorcentaje            !== undefined) updateData.ivaPorcentaje            = String(data.ivaPorcentaje);
    if (data.alertaPresupuestoPct     !== undefined) updateData.alertaPresupuestoPct     = data.alertaPresupuestoPct;
    if (data.diasNotifRecurrente      !== undefined) updateData.diasNotifRecurrente      = data.diasNotifRecurrente;
    if (data.diasNotifCorte           !== undefined) updateData.diasNotifCorte           = data.diasNotifCorte;
    if (data.autoRegistrarRecurrentes !== undefined) updateData.autoRegistrarRecurrentes = data.autoRegistrarRecurrentes;
    if (data.cryptoUpdateIntervalMin  !== undefined) updateData.cryptoUpdateIntervalMin  = data.cryptoUpdateIntervalMin;
    if (data.diaInicioSemana          !== undefined) updateData.diaInicioSemana          = data.diaInicioSemana;

    const [updated] = await this.db
      .update(userSettings)
      .set(updateData as any)
      .where(eq(userSettings.usuarioId, usuarioId))
      .returning();

    return updated ?? null;
  }

  // ── NOTIFICATION PREFERENCES ─────────────────────────────────────────────────

  async updateNotificationPref(usuarioId: string, evento: string, data: {
    canalEmail?:    boolean;
    canalTelegram?: boolean;
    canalPush?:     boolean;
  }) {
    const updateData: Record<string, unknown> = {};
    if (data.canalEmail    !== undefined) updateData.canalEmail    = data.canalEmail;
    if (data.canalTelegram !== undefined) updateData.canalTelegram = data.canalTelegram;
    if (data.canalPush     !== undefined) updateData.canalPush     = data.canalPush;

    const [updated] = await this.db
      .update(notificationPreferences)
      .set(updateData as any)
      .where(and(
        eq(notificationPreferences.usuarioId, usuarioId),
        eq(notificationPreferences.evento, evento),
      ))
      .returning();

    return updated ?? null;
  }

  // ── FCM TOKENS ───────────────────────────────────────────────────────────────

  async registerFcmToken(usuarioId: string, token: string) {
    // Upsert: si el token ya existe de otro user, reasignar; si es del mismo user, ignorar
    const existing = await this.db
      .select({ id: fcmTokens.id, usuarioId: fcmTokens.usuarioId })
      .from(fcmTokens)
      .where(eq(fcmTokens.token, token));

    if (existing.length > 0) {
      if (existing[0].usuarioId === usuarioId) {
        return { message: 'Token ya registrado' };
      }
      // Token de otro usuario → reasignar
      await this.db
        .update(fcmTokens)
        .set({ usuarioId })
        .where(eq(fcmTokens.token, token));
      return { message: 'Token reasignado' };
    }

    await this.db.insert(fcmTokens).values({ usuarioId, token });
    return { message: 'Token registrado' };
  }

  async deleteFcmToken(usuarioId: string, token: string) {
    const [deleted] = await this.db
      .delete(fcmTokens)
      .where(and(eq(fcmTokens.token, token), eq(fcmTokens.usuarioId, usuarioId)))
      .returning({ id: fcmTokens.id });
    return deleted ?? null;
  }
}
