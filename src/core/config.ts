import { config } from 'dotenv';
config();

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optionalEnv(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

export const env = {
  NODE_ENV:                 optionalEnv('NODE_ENV', 'development'),
  PORT:                     parseInt(optionalEnv('PORT', '3000')),
  HOST:                     optionalEnv('HOST', '0.0.0.0'),

  DATABASE_URL:             requireEnv('DATABASE_URL'),
  REDIS_URL:                requireEnv('REDIS_URL'),

  JWT_SECRET:               requireEnv('JWT_SECRET'),
  JWT_ACCESS_EXPIRES_IN:    optionalEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
  JWT_REFRESH_EXPIRES_DAYS: parseInt(optionalEnv('JWT_REFRESH_EXPIRES_DAYS', '30')),

  RESEND_API_KEY:           optionalEnv('RESEND_API_KEY'),
  EMAIL_FROM:               optionalEnv('EMAIL_FROM', 'noreply@sotang.app'),

  TELEGRAM_BOT_TOKEN:       optionalEnv('TELEGRAM_BOT_TOKEN'),
  TELEGRAM_WEBHOOK_SECRET:  optionalEnv('TELEGRAM_WEBHOOK_SECRET'),

  COINGECKO_API_KEY:        optionalEnv('COINGECKO_API_KEY'),

  FIREBASE_CREDENTIALS_JSON: optionalEnv('FIREBASE_CREDENTIALS_JSON'),
  GDRIVE_SERVICE_ACCOUNT_JSON: optionalEnv('GDRIVE_SERVICE_ACCOUNT_JSON'),
  GDRIVE_BACKUP_FOLDER_ID:  optionalEnv('GDRIVE_BACKUP_FOLDER_ID'),

  INTERNAL_API_KEY:         requireEnv('INTERNAL_API_KEY'),

  get isDev()  { return this.NODE_ENV === 'development'; },
  get isProd() { return this.NODE_ENV === 'production'; },
} as const;
