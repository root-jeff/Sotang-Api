import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from './config';

// Conexión única (Singleton, igual que core/db.ts): BullMQ exige maxRetriesPerRequest: null
export const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

// Conexión separada para cache (comandos con reintentos normales)
export const cache = new IORedis(env.REDIS_URL);

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: { count: 500 },
  removeOnFail: false as const, // auditoría de fallos
};

export const QUEUE_NAMES = {
  notifications: 'notifications',
  budgets: 'budgets',
  recurring: 'recurring',
  reports: 'reports',
  backup: 'backup',
} as const;

export const notificationsQueue = new Queue(QUEUE_NAMES.notifications, { connection: redis, defaultJobOptions });
export const budgetQueue        = new Queue(QUEUE_NAMES.budgets,       { connection: redis, defaultJobOptions });
export const recurringQueue     = new Queue(QUEUE_NAMES.recurring,     { connection: redis, defaultJobOptions });
export const reportsQueue       = new Queue(QUEUE_NAMES.reports,       { connection: redis, defaultJobOptions });
export const backupQueue        = new Queue(QUEUE_NAMES.backup,        { connection: redis, defaultJobOptions });

// ── Cache helpers (dashboard TTL 5 min) ─────────────────────────────────────
const DASHBOARD_TTL_S = 300;

export const dashboardCacheKey = (usuarioId: string) => `dashboard:${usuarioId}`;

export async function getCachedDashboard(usuarioId: string): Promise<unknown | null> {
  const raw = await cache.get(dashboardCacheKey(usuarioId));
  return raw ? JSON.parse(raw) : null;
}

export async function setCachedDashboard(usuarioId: string, data: unknown): Promise<void> {
  await cache.set(dashboardCacheKey(usuarioId), JSON.stringify(data), 'EX', DASHBOARD_TTL_S);
}

export async function invalidateDashboard(usuarioId: string): Promise<void> {
  await cache.del(dashboardCacheKey(usuarioId));
}
