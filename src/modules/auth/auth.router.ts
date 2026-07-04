import type { FastifyInstance } from "fastify";
import { AuthService } from "./auth.service";
import {
  LoginBody,
  RegisterBody,
  RefreshBody,
  LogoutBody,
  AuthTokensResponse,
  MessageResponse,
  ErrorResponse,
  type RegisterBodyType,
  type LoginBodyType,
  type RefreshBodyType,
} from "./auth.schema";

export default async function authRoutes(app: FastifyInstance) {
  const svc = new AuthService(app);

  // ── POST /auth/register ───────────────────────────────────────────────────
  app.post<{ Body: RegisterBodyType }>(
    "/register",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        tags: ["Auth"],
        summary: "Registrar nuevo usuario",
        description: `
Crea una cuenta nueva y retorna tokens de acceso inmediatamente.

**Efectos secundarios:**
- Crea \`user_settings\` con valores por defecto (IVA 15%, alertas 80%, etc.)
- Crea 10 registros de \`notification_preferences\` (todos habilitados por defecto)

**Rate limit:** 5 peticiones/minuto por IP.
      `.trim(),
        body: RegisterBody,
        response: {
          201: {
            ...AuthTokensResponse,
            description: "Usuario creado. Tokens listos para usar.",
          },
          409: {
            ...ErrorResponse,
            description: "El email ya está registrado.",
          },
          422: {
            ...ErrorResponse,
            description:
              "Validación fallida (email inválido, password muy corta, etc.)",
          },
          429: {
            ...ErrorResponse,
            description: "Rate limit: máximo 5 registros/minuto por IP.",
          },
        },
      },
    },
    async (req, reply) => {
      const result = await svc.register(req.body);
      return reply.status(201).send(result);
    },
  );

  // ── POST /auth/login ──────────────────────────────────────────────────────
  app.post<{ Body: LoginBodyType }>(
    "/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        tags: ["Auth"],
        summary: "Iniciar sesión",
        description: `
Autentica al usuario con email y contraseña. Retorna un \`accessToken\` (JWT, 15 min)
y un \`refreshToken\` (opaco, 30 días, rotación automática).

**Seguridad anti-enumeración:** el mensaje de error es idéntico si el email no existe
o si la contraseña es incorrecta.

**Rate limit:** 10 peticiones/minuto por IP.
      `.trim(),
        body: LoginBody,
        response: {
          200: {
            ...AuthTokensResponse,
            description:
              "Login exitoso. Guarda los tokens de forma segura (SecureStore en mobile).",
          },
          401: {
            ...ErrorResponse,
            description:
              "Credenciales inválidas (email o contraseña incorrectos).",
          },
          429: {
            ...ErrorResponse,
            description: "Rate limit: máximo 10 intentos/minuto por IP.",
          },
        },
      },
    },
    async (req, reply) => {
      const { email, password } = req.body;
      const result = await svc.login(email, password);
      return reply.send(result);
    },
  );

  // ── POST /auth/refresh ────────────────────────────────────────────────────
  app.post<{ Body: RefreshBodyType }>(
    "/refresh",
    {
      schema: {
        tags: ["Auth"],
        summary: "Renovar access token",
        description: `
Intercambia un \`refreshToken\` válido por un nuevo par de tokens (**rotación automática**).

El token antiguo queda **inmediatamente revocado** al usarse. Si intentas reusar
el mismo refresh token, recibirás 401.

**Flujo recomendado en mobile:**
1. Interceptor de RTK Query detecta 401 en cualquier request
2. Llama automáticamente a \`POST /auth/refresh\`
3. Reemplaza tokens en SecureStore
4. Reintenta el request original
      `.trim(),
        body: RefreshBody,
        response: {
          200: {
            ...AuthTokensResponse,
            description:
              "Tokens renovados. El refresh token anterior ya no es válido.",
          },
          401: {
            ...ErrorResponse,
            description: "Refresh token inválido, expirado o ya revocado.",
          },
        },
      },
    },
    async (req, reply) => {
      const result = await svc.refresh(req.body.refreshToken);
      return reply.send(result);
    },
  );

  // ── POST /auth/logout ─────────────────────────────────────────────────────
  app.post(
    "/logout",
    {
      preHandler: [app.verifyJWT],
      schema: {
        tags: ["Auth"],
        summary: "Cerrar sesión",
        description: `
Revoca el \`refreshToken\` indicado. El \`accessToken\` sigue siendo técnicamente válido
hasta su expiración (15 min) pero el refresh queda inutilizable.

**Requiere:** \`Authorization: Bearer {accessToken}\`
      `.trim(),
        security: [{ bearerAuth: [] }],
        body: LogoutBody,
        response: {
          200: {
            ...MessageResponse,
            description: "Sesión cerrada. Refresh token revocado.",
          },
          401: { ...ErrorResponse, description: "Access token requerido." },
        },
      },
    },
    async (req, reply) => {
      const { refreshToken } = req.body as any;
      await svc.logout(refreshToken);
      return reply.send({ message: "Logged out successfully" });
    },
  );
}
