import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { RecurringService } from './recurring.service';
import { InvalidStateError } from './recurring-state/index';

const Frecuencia = Type.Union([
  Type.Literal('diaria'), Type.Literal('semanal'), Type.Literal('quincenal'),
  Type.Literal('mensual'), Type.Literal('anual'),
]);

const CreateRecurringBody = Type.Object({
  tipo:        Type.Union([Type.Literal('ingreso'), Type.Literal('gasto')]),
  monto:       Type.Number({ minimum: 0.01 }),
  categoriaId: Type.String({ format: 'uuid' }),
  cuentaId:    Type.String({ format: 'uuid' }),
  descripcion: Type.Optional(Type.String({ maxLength: 500 })),
  frecuencia:  Frecuencia,
  diaMes:      Type.Optional(Type.Integer({ minimum: 1, maximum: 31 })),
  diaSemana:   Type.Optional(Type.Integer({ minimum: 0, maximum: 6 })),
  fechaInicio: Type.String({ format: 'date' }),
  fechaFin:    Type.Optional(Type.String({ format: 'date' })),
  modoIva:     Type.Optional(Type.Union([Type.Literal('ninguno'), Type.Literal('incluido'), Type.Literal('adicional')])),
}, { $id: 'CreateRecurringBody' });

const RecurringResponse = Type.Object({
  id:               Type.String({ format: 'uuid' }),
  usuarioId:        Type.String({ format: 'uuid' }),
  tipo:             Type.String(),
  monto:            Type.String(),
  categoriaId:      Type.String({ format: 'uuid' }),
  cuentaId:         Type.String({ format: 'uuid' }),
  descripcion:      Type.Union([Type.String(), Type.Null()]),
  frecuencia:       Type.String(),
  fechaInicio:      Type.String(),
  fechaFin:         Type.Union([Type.String(), Type.Null()]),
  proximaEjecucion: Type.String(),
  ultimaEjecucion:  Type.Union([Type.String(), Type.Null()]),
  estado:           Type.String({ description: 'Patrón State: configured | pending | notified | executed | cancelled' }),
  modoIva:          Type.String(),
  activa:           Type.Boolean(),
  creadoEn:         Type.String(),
}, { $id: 'RecurringResponse' });

export default async function recurringRoutes(app: FastifyInstance) {
  const svc = new RecurringService();

  const errMap: Record<string, [number, string]> = {
    ACCOUNT_NOT_FOUND:  [404, 'Cuenta no encontrada'],
    CATEGORY_NOT_FOUND: [404, 'Categoría no encontrada'],
  };
  const handle = (reply: any, err: any) => {
    if (err instanceof InvalidStateError) {
      return reply.status(409).send({ statusCode: 409, error: 'INVALID_STATE_TRANSITION', message: err.message });
    }
    const [code, msg] = errMap[err.message] ?? [500, err.message];
    return reply.status(code).send({ statusCode: code, error: err.message, message: msg });
  };

  app.post('/', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Recurring'],
      summary: 'Crear transacción recurrente',
      description: 'Crea una recurrente en estado `configured` y la agenda inmediatamente (transición State → `pending`). El worker la ejecuta en cada `proximaEjecucion`, con recordatorio D-1 y garantía de idempotencia.',
      security: [{ bearerAuth: [] }],
      body: CreateRecurringBody,
      response: { 201: RecurringResponse, 404: { $ref: 'ErrorResponse' } },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    try {
      const rec = await svc.create(usuarioId, req.body as any);
      return reply.status(201).send(rec);
    } catch (err: any) { return handle(reply, err); }
  });

  app.get('/', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Recurring'],
      summary: 'Listar transacciones recurrentes',
      security: [{ bearerAuth: [] }],
      response: { 200: Type.Object({ data: Type.Array(RecurringResponse) }) },
    },
  }, async (req) => {
    const usuarioId = (req.user as { sub: string }).sub;
    return { data: await svc.list(usuarioId) };
  });

  app.get('/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Recurring'],
      summary: 'Detalle de una recurrente',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: RecurringResponse, 404: { $ref: 'ErrorResponse' } },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const rec = await svc.getOne(usuarioId, (req.params as any).id);
    if (!rec) return reply.status(404).send({ statusCode: 404, error: 'NOT_FOUND', message: 'Recurrente no encontrada' });
    return rec;
  });

  app.post('/:id/cancel', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Recurring'],
      summary: 'Cancelar una recurrente (transición State → cancelled)',
      description: 'Válido desde cualquier estado no terminal. Cancelar una ya cancelada retorna 409 (InvalidStateError).',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: RecurringResponse, 404: { $ref: 'ErrorResponse' }, 409: { $ref: 'ErrorResponse' } },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    try {
      const rec = await svc.cancel(usuarioId, (req.params as any).id);
      if (!rec) return reply.status(404).send({ statusCode: 404, error: 'NOT_FOUND', message: 'Recurrente no encontrada' });
      return rec;
    } catch (err: any) { return handle(reply, err); }
  });
}
