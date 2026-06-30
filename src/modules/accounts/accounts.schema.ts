import { Type, type Static } from '@sinclair/typebox';

const AccountType = Type.Union([
  Type.Literal('banco'),
  Type.Literal('tarjeta_credito'),
  Type.Literal('efectivo'),
  Type.Literal('ahorro_virtual'),
  Type.Literal('ahorro_cuenta'),
  Type.Literal('fondo_inversion'),
  Type.Literal('cripto'),
], { description: 'Tipo de cuenta' });

export const CreateAccountBody = Type.Object({
  nombre:         Type.String({ minLength: 1, maxLength: 100, example: 'Banco Guayaquil' }),
  tipo:           AccountType,
  moneda:         Type.Optional(Type.String({ minLength: 3, maxLength: 3, default: 'USD', example: 'USD' })),
  saldoInicial:   Type.Optional(Type.Number({ minimum: 0, default: 0, example: 1200.50 })),
  color:          Type.Optional(Type.String({ pattern: '^#[0-9A-Fa-f]{6}$', default: '#6366f1', example: '#6366f1' })),
  icono:          Type.Optional(Type.String({ maxLength: 50, example: 'bank' })),
  incluirEnTotal: Type.Optional(Type.Boolean({ default: true })),
  orden:          Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
  notas:          Type.Optional(Type.String({ maxLength: 500 })),
  // Solo para tipo tarjeta_credito
  tarjeta: Type.Optional(Type.Object({
    cupoTotal:        Type.Number({ minimum: 0, example: 900 }),
    fechaCorte:       Type.Integer({ minimum: 1, maximum: 31, example: 15 }),
    fechaPago:        Type.Integer({ minimum: 1, maximum: 31, example: 5 }),
    banco:            Type.Optional(Type.String({ example: 'Diners Club' })),
    ultimos4:         Type.Optional(Type.String({ minLength: 4, maxLength: 4, example: '1234' })),
    tasaInteresAnual: Type.Optional(Type.Number({ minimum: 0, example: 16.77 })),
    cupoGrupoId:      Type.Optional(Type.String({ format: 'uuid', description: 'ID del grupo de cupo compartido (ej: Diners + Titanium)' })),
  })),
  // Solo para tipo cripto
  cripto: Type.Optional(Type.Object({
    simbolo:              Type.String({ example: 'BTC' }),
    coingeckoId:          Type.String({ example: 'bitcoin' }),
    cantidad:             Type.Optional(Type.Number({ minimum: 0, default: 0 })),
    precioCompraPromedio: Type.Optional(Type.Number({ minimum: 0 })),
  })),
  // Solo para tipo ahorro_virtual
  ahorroVirtual: Type.Optional(Type.Object({
    cuentaPadreId: Type.String({ format: 'uuid', description: 'ID de la cuenta real que contiene este ahorro virtual' }),
  })),
}, { $id: 'CreateAccountBody' });

export const AccountResponse = Type.Object({
  id:             Type.String({ format: 'uuid' }),
  usuarioId:      Type.String({ format: 'uuid' }),
  nombre:         Type.String(),
  tipo:           Type.String(),
  moneda:         Type.String(),
  saldoInicial:   Type.String(),
  saldoActual:    Type.String(),
  color:          Type.String(),
  icono:          Type.Optional(Type.String()),
  activa:         Type.Boolean(),
  incluirEnTotal: Type.Boolean(),
  orden:          Type.Number(),
  notas:          Type.Optional(Type.String()),
  creadoEn:       Type.String({ format: 'date-time' }),
}, { $id: 'AccountResponse' });

export type CreateAccountBodyType = Static<typeof CreateAccountBody>;
