import { Type, type Static } from '@sinclair/typebox';

// ── Shared components ──────────────────────────────────────────────────────────

export const UserPublic = Type.Object({
  id:       Type.String({ format: 'uuid', description: 'UUID del usuario' }),
  nombre:   Type.String({ description: 'Nombre completo', example: 'Jefferson Palma' }),
  email:    Type.String({ format: 'email', description: 'Email del usuario', example: 'jeff@sotang.app' }),
  moneda:   Type.String({ description: 'Moneda por defecto ISO 4217', example: 'USD' }),
  timezone: Type.String({ description: 'Timezone IANA', example: 'America/Guayaquil' }),
}, { $id: 'UserPublic', description: 'Datos públicos del usuario autenticado' });

export const AuthTokensResponse = Type.Object({
  accessToken:  Type.String({
    description: 'JWT de acceso. Incluir en header: Authorization: Bearer <token>. Expira en 15 min.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  }),
  refreshToken: Type.String({
    description: 'Token opaco de 64 bytes (hex). Usar en POST /auth/refresh. Expira en 30 días. Rotación automática.',
    example: 'a3f8c2d1e4b5...',
  }),
  user: UserPublic,
}, { $id: 'AuthTokensResponse' });

export const ErrorResponse = Type.Object({
  error:   Type.String({ description: 'Código de error en snake_case', example: 'unauthorized' }),
  message: Type.Optional(Type.String({ description: 'Descripción legible del error' })),
}, { $id: 'ErrorResponse' });

// ── Request bodies ─────────────────────────────────────────────────────────────

export const RegisterBody = Type.Object({
  nombre: Type.String({
    minLength: 2,
    maxLength: 100,
    description: 'Nombre completo del usuario',
    example: 'Jefferson Palma',
  }),
  email: Type.String({
    format: 'email',
    description: 'Email único — se convierte a minúsculas',
    example: 'jeff@sotang.app',
  }),
  password: Type.String({
    minLength: 8,
    description: 'Contraseña mínimo 8 caracteres. Se hashea con bcrypt cost=12.',
    example: 'miPassword123',
  }),
  timezone: Type.Optional(Type.String({
    description: 'Timezone IANA. Default: America/Guayaquil',
    example: 'America/Guayaquil',
    default: 'America/Guayaquil',
  })),
}, { $id: 'RegisterBody' });

export const LoginBody = Type.Object({
  email: Type.String({
    format: 'email',
    description: 'Email registrado',
    example: 'jeff@sotang.app',
  }),
  password: Type.String({
    minLength: 8,
    description: 'Contraseña del usuario',
    example: 'miPassword123',
  }),
}, { $id: 'LoginBody' });

export const RefreshBody = Type.Object({
  refreshToken: Type.String({
    description: 'Refresh token recibido en login o register. Se revoca y se emite uno nuevo (rotación).',
    example: 'a3f8c2d1e4b5...',
  }),
}, { $id: 'RefreshBody' });

export const LogoutBody = Type.Object({
  refreshToken: Type.String({
    description: 'Refresh token a revocar. Después de logout, el token queda inválido.',
    example: 'a3f8c2d1e4b5...',
  }),
}, { $id: 'LogoutBody' });

// ── Response schemas ───────────────────────────────────────────────────────────

export const MessageResponse = Type.Object({
  message: Type.String({ example: 'Logged out successfully' }),
}, { $id: 'MessageResponse' });

// ── Static types ───────────────────────────────────────────────────────────────

export type RegisterBodyType = Static<typeof RegisterBody>;
export type LoginBodyType    = Static<typeof LoginBody>;
export type RefreshBodyType  = Static<typeof RefreshBody>;
