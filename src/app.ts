import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import multipart from '@fastify/multipart';

import { env } from './core/config';
import jwtPlugin from './core/plugins/jwt';
import { ErrorResponse } from './modules/auth/auth.schema';

// ── Modules
import authRoutes from './modules/auth/auth.router';
import accountsRoutes from './modules/accounts/accounts.router';
import transactionsRoutes from './modules/transactions/transactions.router';
import categoriesRoutes from './modules/transactions/categories.router';
import budgetsRoutes from './modules/budgets/budgets.router';
import goalsRoutes from './modules/goals/goals.router';
import usersRoutes from './modules/users/users.router';
import patrimonyRoutes from './modules/patrimony/patrimony.router';
import receivablesRoutes from './modules/receivables/receivables.router';
import recurringRoutes from './modules/transactions/recurring.router';
import dashboardRoutes from './modules/dashboard/dashboard.router';
import notificationsRoutes from './modules/notifications/notifications.router';
import reportsRoutes from './modules/reports/reports.router';
import backupRoutes from './modules/backup/backup.router';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.isDev ? 'debug' : 'info',
      transport: env.isDev
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
    trustProxy: true,
    // AJV: permitir keywords de OpenAPI (example, description, $id) sin error
    ajv: {
      customOptions: {
        strict: false,
      },
    },
  });

  // ── Security
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: env.isDev ? true : ['https://sotang.raas-xtr.online'],
    credentials: true,
  });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  // ── Utils
  await app.register(sensible);
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  // ── OpenAPI (detallado)
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Sotang API',
        version: '1.0.0',
        description: `
## Sotang — Personal Finance API

REST API del ecosistema **Sotang**. Corre en Raspberry Pi 5 con acceso vía Cloudflare Tunnels.
Todos los datos son 100% locales — sin servicios cloud para datos propios.

### Autenticación
Usa **JWT Bearer**. El flujo es:
1. \`POST /auth/register\` o \`POST /auth/login\` → obtienes \`accessToken\` + \`refreshToken\`
2. Incluye el \`accessToken\` en el header: \`Authorization: Bearer <token>\`
3. El \`accessToken\` expira en **15 minutos**. Usa \`POST /auth/refresh\` para renovarlo.

### Canales de acceso
| Canal | Mecanismo |
|-------|-----------|
| Mobile App | \`Authorization: Bearer {accessToken}\` |
| Telegram Bot | \`X-Internal-Key: {secret}\` (solo red interna K3s) |

### Códigos de error comunes
| Código | Significado |
|--------|-------------|
| 401 | Token inválido o expirado |
| 404 | Recurso no encontrado (o no pertenece al usuario) |
| 409 | Conflicto (ej: email ya registrado) |
| 422 | Validación fallida |
| 429 | Rate limit excedido |
| 500 | Error interno — revisar logs Pino |
        `.trim(),
        contact: {
          name: 'Jefferson Palma',
          email: 'jpalmacoloma@gmail.com',
        },
        license: {
          name: 'Private',
        },
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Local development',
        },
        {
          url: 'https://sotang.raas-xtr.online',
          description: 'Production (Raspberry Pi 5 via Cloudflare Tunnel)',
        },
      ],
      tags: [
        { name: 'Auth',         description: 'Registro, login, refresh y logout de sesiones' },
        { name: 'Accounts',     description: 'Cuentas bancarias, tarjetas de crédito, cripto y ahorros' },
        { name: 'Transactions', description: 'Ingresos, gastos y transferencias' },
        { name: 'Categories',   description: 'Categorías y subcategorías de transacciones' },
        { name: 'Budgets',      description: 'Presupuestos por categoría y período' },
        { name: 'Goals',        description: 'Metas de ahorro y aportes' },
        { name: 'Patrimony',    description: 'Activos, pasivos, patrimonio neto y snapshots Equifax' },
        { name: 'Receivables',  description: 'Cobros (dinero que te deben) y deudas (dinero que debes)' },
        { name: 'Reports',      description: 'Dashboard, PDF mensual y exportación Excel' },
        { name: 'Notifications',description: 'Preferencias y historial de notificaciones' },
        { name: 'Users',        description: 'Perfil, configuración y tokens FCM' },
        { name: 'System',       description: 'Health checks y estado del sistema' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Access token obtenido en /auth/login o /auth/register. Expira en 15 min.',
          },
          internalKey: {
            type: 'apiKey',
            in: 'header',
            name: 'X-Internal-Key',
            description: 'Clave compartida entre sotang-bot y sotang-api. Solo válida en red interna K3s.',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      filter: true,
      syntaxHighlight: { activate: true, theme: 'monokai' },
      tryItOutEnabled: true,
      persistAuthorization: true,
    },
    staticCSP: false,
    logo: {
      type: 'image/png',
      content: Buffer.from('').toString('base64'),
    },
  });

  // ── Global schemas (available via $ref in all routes)
  app.addSchema(ErrorResponse);

  // ── Auth plugin
  await app.register(jwtPlugin);

  // ── Health
  app.get('/health', {
    schema: {
      hide: false,
      tags: ['System'],
      summary: 'Health check básico',
      description: 'Verifica que el servidor está corriendo. Usado por K3s readinessProbe.',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            ts:     { type: 'string', format: 'date-time', example: '2026-06-29T03:00:00.000Z' },
          },
        },
      },
    },
  }, async () => ({ status: 'ok', ts: new Date().toISOString() }));

  app.get('/health/ready', {
    schema: {
      hide: false,
      tags: ['System'],
      summary: 'Readiness check',
      description: 'Indica si el servidor está listo para recibir tráfico (DB conectada, migraciones aplicadas).',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ready' },
          },
        },
      },
    },
  }, async () => ({ status: 'ready' }));

  // ── API Routes
  await app.register(authRoutes,         { prefix: '/api/v1/auth' });
  await app.register(accountsRoutes,     { prefix: '/api/v1/accounts' });
  await app.register(transactionsRoutes, { prefix: '/api/v1/transactions' });
  await app.register(categoriesRoutes,   { prefix: '/api/v1/categories' });
  await app.register(budgetsRoutes,      { prefix: '/api/v1/budgets' });
  await app.register(goalsRoutes,        { prefix: '/api/v1/goals' });
  await app.register(usersRoutes,        { prefix: '/api/v1/users' });
  await app.register(patrimonyRoutes,    { prefix: '/api/v1/patrimony' });
  await app.register(receivablesRoutes,  { prefix: '/api/v1' });
  await app.register(recurringRoutes,    { prefix: '/api/v1/transactions/recurring' });
  await app.register(dashboardRoutes,    { prefix: '/api/v1/dashboard' });
  await app.register(notificationsRoutes, { prefix: '/api/v1/notifications' });
  await app.register(reportsRoutes,      { prefix: '/api/v1/reports' });
  await app.register(backupRoutes,       { prefix: '/api/v1/backup' });

  return app;
}
