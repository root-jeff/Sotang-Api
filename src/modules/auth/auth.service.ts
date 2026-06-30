import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { eq, and, gt } from 'drizzle-orm';
import { getDb } from '../../core/db';
import { env } from '../../core/config';
import { users, refreshTokens, userSettings, notificationPreferences } from '../../db/schema/index';
import type { FastifyInstance } from 'fastify';

const BCRYPT_ROUNDS = 12;

const NOTIFICATION_EVENTS = [
  'recurrente_dia_antes',
  'corte_tarjeta_dia_antes',
  'meta_completada',
  'meta_progreso',
  'presupuesto_alerta',
  'presupuesto_excedido',
  'deuda_vencida',
  'cuenta_cobrar_recordatorio',
  'backup_fallido',
  'crypto_precio_error',
];

export class AuthService {
  constructor(private fastify: FastifyInstance) {}

  private get db() { return getDb(); }

  async register(data: { nombre: string; email: string; password: string; timezone?: string }) {
    // Check duplicate email
    const existing = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    const [user] = await this.db.insert(users).values({
      nombre:       data.nombre.trim(),
      email:        data.email.toLowerCase(),
      passwordHash,
      timezone:     data.timezone ?? 'America/Guayaquil',
    }).returning();

    // Create default settings
    await this.db.insert(userSettings).values({ usuarioId: user.id });

    // Create default notification preferences
    await this.db.insert(notificationPreferences).values(
      NOTIFICATION_EVENTS.map(evento => ({
        usuarioId: user.id,
        evento,
        canalEmail:    true,
        canalTelegram: true,
        canalPush:     true,
      }))
    );

    return this.issueTokens(user);
  }

  async login(email: string, password: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email.toLowerCase()), eq(users.activo, true)))
      .limit(1);

    // Constant-time comparison even if user not found
    const hash = user?.passwordHash ?? '$2b$12$invalidhashtopreventtimingattacks';
    const valid = await bcrypt.compare(password, hash);

    if (!user || !valid) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    // Update last login (fire and forget)
    this.db.update(users)
      .set({ ultimoLogin: new Date() })
      .where(eq(users.id, user.id))
      .catch(() => {});

    return this.issueTokens(user);
  }

  async refresh(token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [stored] = await this.db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          eq(refreshTokens.revocado, false),
          gt(refreshTokens.expiraEn, new Date()),
        )
      )
      .limit(1);

    if (!stored) {
      throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });
    }

    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, stored.usuarioId), eq(users.activo, true)))
      .limit(1);

    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 401 });
    }

    // Rotate: revoke old, issue new
    await this.db.update(refreshTokens)
      .set({ revocado: true })
      .where(eq(refreshTokens.id, stored.id));

    return this.issueTokens(user);
  }

  async logout(token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await this.db.update(refreshTokens)
      .set({ revocado: true })
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }

  private async issueTokens(user: typeof users.$inferSelect) {
    const accessToken = this.fastify.jwt.sign(
      { sub: user.id, email: user.email, type: 'access' },
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
    );

    const rawRefresh = crypto.randomBytes(64).toString('hex');
    const tokenHash  = crypto.createHash('sha256').update(rawRefresh).digest('hex');
    const expiraEn   = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 86_400_000);

    await this.db.insert(refreshTokens).values({
      usuarioId: user.id,
      tokenHash,
      expiraEn,
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      user: {
        id:       user.id,
        nombre:   user.nombre,
        email:    user.email,
        moneda:   user.moneda,
        timezone: user.timezone,
      },
    };
  }
}
