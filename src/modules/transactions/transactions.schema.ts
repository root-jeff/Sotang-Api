import { Type, type Static } from '@sinclair/typebox';

const TipoTxn = Type.Union([
  Type.Literal('ingreso'),
  Type.Literal('gasto'),
  Type.Literal('transferencia'),
], { description: 'Tipo de transacción' });

const EstadoTxn = Type.Union([
  Type.Literal('completada'),
  Type.Literal('pendiente'),
  Type.Literal('en_proceso'),
  Type.Literal('anulada'),
]);

const CanalTxn = Type.Union([
  Type.Literal('mobile'),
  Type.Literal('web'),
  Type.Literal('telegram'),
  Type.Literal('email'),
]);

export const CreateTransactionBody = Type.Object({
  tipo:            TipoTxn,
  monto:           Type.Number({ minimum: 0.01, example: 45.50 }),
  categoriaId:     Type.String({ format: 'uuid' }),
  cuentaId:        Type.String({ format: 'uuid' }),
  fecha:           Type.String({ format: 'date', example: '2026-06-29' }),
  descripcion:     Type.Optional(Type.String({ maxLength: 500, example: 'Almuerzo en el trabajo' })),
  notas:           Type.Optional(Type.String({ maxLength: 2000 })),
  estado:          Type.Optional(EstadoTxn),
  canal:           Type.Optional(CanalTxn),
  // Transferencias
  cuentaDestinoId: Type.Optional(Type.String({ format: 'uuid', description: 'Requerido si tipo=transferencia' })),
  // IVA (Ecuador)
  incluyeIva:      Type.Optional(Type.Boolean({ default: false, description: 'Si el monto ya incluye IVA (15%)' })),
  // Etiquetas
  etiquetas:       Type.Optional(Type.Array(Type.String({ format: 'uuid' }), { description: 'IDs de etiquetas a asociar' })),
}, { $id: 'CreateTransactionBody' });

export const TransactionResponse = Type.Object({
  id:              Type.String({ format: 'uuid' }),
  usuarioId:       Type.String({ format: 'uuid' }),
  tipo:            Type.String(),
  monto:           Type.String(),
  montoSinIva:     Type.Union([Type.String(), Type.Null()]),
  ivaMonto:        Type.Union([Type.String(), Type.Null()]),
  incluyeIva:      Type.Boolean(),
  categoriaId:     Type.String({ format: 'uuid' }),
  cuentaId:        Type.String({ format: 'uuid' }),
  cuentaDestinoId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  descripcion:     Type.Union([Type.String(), Type.Null()]),
  fecha:           Type.String({ format: 'date' }),
  canal:           Type.String(),
  estado:          Type.String(),
  notas:           Type.Union([Type.String(), Type.Null()]),
  creadoEn:        Type.String({ format: 'date-time' }),
  actualizadoEn:   Type.String({ format: 'date-time' }),
}, { $id: 'TransactionResponse' });

export const ListTransactionsQuery = Type.Object({
  page:        Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit:       Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 30 })),
  tipo:        Type.Optional(Type.String({ description: 'ingreso | gasto | transferencia' })),
  cuentaId:    Type.Optional(Type.String({ format: 'uuid' })),
  categoriaId: Type.Optional(Type.String({ format: 'uuid' })),
  desde:       Type.Optional(Type.String({ format: 'date', description: 'Fecha inicio (YYYY-MM-DD)' })),
  hasta:       Type.Optional(Type.String({ format: 'date', description: 'Fecha fin (YYYY-MM-DD)' })),
  estado:      Type.Optional(Type.String()),
}, { $id: 'ListTransactionsQuery' });

export type CreateTransactionBodyType = Static<typeof CreateTransactionBody>;
export type ListTransactionsQueryType = Static<typeof ListTransactionsQuery>;
