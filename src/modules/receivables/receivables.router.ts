import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { ReceivablesService } from './receivables.service';

const ReceivableResponse = Type.Object({
  id:            Type.String({ format: 'uuid' }),
  usuarioId:     Type.String({ format: 'uuid' }),
  deudorNombre:  Type.String(),
  concepto:      Type.String(),
  montoTotal:    Type.String(),
  montoPagado:   Type.String(),
  moneda:        Type.String(),
  fechaPrestamo: Type.String({ format: 'date' }),
  fechaVencim:   Type.Union([Type.String({ format: 'date' }), Type.Null()]),
  estado:        Type.String(),
  notas:         Type.Union([Type.String(), Type.Null()]),
  creadoEn:      Type.String({ format: 'date-time' }),
  actualizadoEn: Type.String({ format: 'date-time' }),
}, { $id: 'ReceivableResponse' });

const DebtResponse = Type.Object({
  id:             Type.String({ format: 'uuid' }),
  usuarioId:      Type.String({ format: 'uuid' }),
  acreedorNombre: Type.String(),
  concepto:       Type.String(),
  montoTotal:     Type.String(),
  montoPagado:    Type.String(),
  moneda:         Type.String(),
  fechaDeuda:     Type.String({ format: 'date' }),
  fechaVencim:    Type.Union([Type.String({ format: 'date' }), Type.Null()]),
  estado:         Type.String(),
  notas:          Type.Union([Type.String(), Type.Null()]),
  creadoEn:       Type.String({ format: 'date-time' }),
  actualizadoEn:  Type.String({ format: 'date-time' }),
}, { $id: 'DebtResponse' });

const PaymentResult = (entityField: string) => Type.Object({
  payment: Type.Object({
    id:       Type.String({ format: 'uuid' }),
    [entityField]: Type.String({ format: 'uuid' }),
    monto:    Type.String(),
    fecha:    Type.String({ format: 'date' }),
    nota:     Type.Union([Type.String(), Type.Null()]),
    creadoEn: Type.String({ format: 'date-time' }),
  }),
  estado:       Type.String(),
  montoPagado:  Type.String(),
});

const estadoReceivableQuery = Type.Object({
  estado: Type.Optional(Type.Union([
    Type.Literal('pendiente'), Type.Literal('parcial'),
    Type.Literal('cobrado'),   Type.Literal('incobrable'),
  ])),
});

const estadoDebtQuery = Type.Object({
  estado: Type.Optional(Type.Union([
    Type.Literal('pendiente'), Type.Literal('parcial'), Type.Literal('pagada'),
  ])),
});

export default async function receivablesRoutes(app: FastifyInstance) {
  const svc = new ReceivablesService();

  // ────────────────────────────────────────────────────────────────────────────
  // RECEIVABLES — cobros (dinero que me deben)
  // ────────────────────────────────────────────────────────────────────────────

  app.post('/receivables', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Receivables'],
      summary: 'Registrar cobro',
      description: 'Registra dinero que alguien te debe. Los pagos parciales se registran en `/receivables/:id/payments`.',
      security: [{ bearerAuth: [] }],
      body: Type.Object({
        deudorNombre:  Type.String({ minLength: 1, maxLength: 100, example: 'Carlos Mendoza' }),
        concepto:      Type.String({ minLength: 1, maxLength: 255, example: 'Préstamo para compra de laptop' }),
        montoTotal:    Type.Number({ minimum: 0.01, example: 500 }),
        moneda:        Type.Optional(Type.String({ minLength: 3, maxLength: 3, default: 'USD' })),
        fechaPrestamo: Type.String({ format: 'date', example: '2026-06-01' }),
        fechaVencim:   Type.Optional(Type.String({ format: 'date', example: '2026-09-01' })),
        notas:         Type.Optional(Type.String({ maxLength: 500 })),
      }),
      response: { 201: ReceivableResponse },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    return reply.status(201).send(await svc.createReceivable(usuarioId, req.body as any));
  });

  app.get('/receivables', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Receivables'],
      summary: 'Listar cobros',
      description: 'Filtra opcionalmente por estado: `pendiente`, `parcial`, `cobrado`, `incobrable`.',
      security: [{ bearerAuth: [] }],
      querystring: estadoReceivableQuery,
      response: { 200: Type.Object({ data: Type.Array(ReceivableResponse) }) },
    },
  }, async (req) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { estado } = req.query as any;
    return { data: await svc.listReceivables(usuarioId, estado) };
  });

  app.get('/receivables/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Receivables'],
      summary: 'Obtener cobro por ID',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: ReceivableResponse, 404: { $ref: 'ErrorResponse' } },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const r = await svc.getReceivable(usuarioId, id);
    if (!r) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Cobro no encontrado' });
    return r;
  });

  app.patch('/receivables/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Receivables'],
      summary: 'Actualizar cobro',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: Type.Partial(Type.Object({
        deudorNombre: Type.String({ minLength: 1, maxLength: 100 }),
        concepto:     Type.String({ minLength: 1, maxLength: 255 }),
        fechaVencim:  Type.String({ format: 'date' }),
        notas:        Type.String({ maxLength: 500 }),
        estado:       Type.Union([
          Type.Literal('pendiente'), Type.Literal('parcial'),
          Type.Literal('cobrado'),   Type.Literal('incobrable'),
        ]),
      })),
      response: { 200: ReceivableResponse, 404: { $ref: 'ErrorResponse' } },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const updated = await svc.updateReceivable(usuarioId, id, req.body as any);
    if (!updated) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Cobro no encontrado' });
    return updated;
  });

  app.delete('/receivables/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Receivables'],
      summary: 'Eliminar cobro',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: Type.Object({ message: Type.String() }), 404: { $ref: 'ErrorResponse' } },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const deleted = await svc.deleteReceivable(usuarioId, id);
    if (!deleted) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Cobro no encontrado' });
    return { message: 'Cobro eliminado' };
  });

  app.post('/receivables/:id/payments', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Receivables'],
      summary: 'Registrar pago de cobro',
      description: 'Registra un pago parcial o total. Actualiza `montoPagado` y `estado` automáticamente (`pendiente → parcial → cobrado`).',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: Type.Object({
        monto: Type.Number({ minimum: 0.01, example: 250 }),
        fecha: Type.String({ format: 'date', example: '2026-07-15' }),
        nota:  Type.Optional(Type.String({ maxLength: 255 })),
      }),
      response: { 201: PaymentResult('cobroId'), 404: { $ref: 'ErrorResponse' } },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    try {
      return reply.status(201).send(await svc.addReceivablePayment(usuarioId, id, req.body as any));
    } catch (err: any) {
      if (err.message === 'RECEIVABLE_NOT_FOUND') return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Cobro no encontrado' });
      throw err;
    }
  });

  app.get('/receivables/:id/payments', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Receivables'],
      summary: 'Listar pagos de un cobro',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: Type.Object({ data: Type.Array(Type.Object({
        id: Type.String(), cobroId: Type.String(), monto: Type.String(),
        fecha: Type.String(), nota: Type.Union([Type.String(), Type.Null()]), creadoEn: Type.String(),
      })) }), 404: { $ref: 'ErrorResponse' } },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    try {
      return { data: await svc.listReceivablePayments(usuarioId, id) };
    } catch (err: any) {
      if (err.message === 'RECEIVABLE_NOT_FOUND') return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Cobro no encontrado' });
      throw err;
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // DEBTS — deudas (dinero que yo debo)
  // ────────────────────────────────────────────────────────────────────────────

  app.post('/debts', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Receivables'],
      summary: 'Registrar deuda',
      description: 'Registra dinero que tú debes a alguien. Los pagos se registran en `/debts/:id/payments`.',
      security: [{ bearerAuth: [] }],
      body: Type.Object({
        acreedorNombre: Type.String({ minLength: 1, maxLength: 100, example: 'Juan Pérez' }),
        concepto:       Type.String({ minLength: 1, maxLength: 255, example: 'Préstamo para arriendo' }),
        montoTotal:     Type.Number({ minimum: 0.01, example: 300 }),
        moneda:         Type.Optional(Type.String({ minLength: 3, maxLength: 3, default: 'USD' })),
        fechaDeuda:     Type.String({ format: 'date', example: '2026-06-01' }),
        fechaVencim:    Type.Optional(Type.String({ format: 'date', example: '2026-08-01' })),
        notas:          Type.Optional(Type.String({ maxLength: 500 })),
      }),
      response: { 201: DebtResponse },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    return reply.status(201).send(await svc.createDebt(usuarioId, req.body as any));
  });

  app.get('/debts', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Receivables'],
      summary: 'Listar deudas',
      description: 'Filtra opcionalmente por estado: `pendiente`, `parcial`, `pagada`.',
      security: [{ bearerAuth: [] }],
      querystring: estadoDebtQuery,
      response: { 200: Type.Object({ data: Type.Array(DebtResponse) }) },
    },
  }, async (req) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { estado } = req.query as any;
    return { data: await svc.listDebts(usuarioId, estado) };
  });

  app.get('/debts/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Receivables'],
      summary: 'Obtener deuda por ID',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: DebtResponse, 404: { $ref: 'ErrorResponse' } },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const d = await svc.getDebt(usuarioId, id);
    if (!d) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Deuda no encontrada' });
    return d;
  });

  app.patch('/debts/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Receivables'],
      summary: 'Actualizar deuda',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: Type.Partial(Type.Object({
        acreedorNombre: Type.String({ minLength: 1, maxLength: 100 }),
        concepto:       Type.String({ minLength: 1, maxLength: 255 }),
        fechaVencim:    Type.String({ format: 'date' }),
        notas:          Type.String({ maxLength: 500 }),
        estado:         Type.Union([
          Type.Literal('pendiente'), Type.Literal('parcial'), Type.Literal('pagada'),
        ]),
      })),
      response: { 200: DebtResponse, 404: { $ref: 'ErrorResponse' } },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const updated = await svc.updateDebt(usuarioId, id, req.body as any);
    if (!updated) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Deuda no encontrada' });
    return updated;
  });

  app.delete('/debts/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Receivables'],
      summary: 'Eliminar deuda',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: Type.Object({ message: Type.String() }), 404: { $ref: 'ErrorResponse' } },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const deleted = await svc.deleteDebt(usuarioId, id);
    if (!deleted) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Deuda no encontrada' });
    return { message: 'Deuda eliminada' };
  });

  app.post('/debts/:id/payments', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Receivables'],
      summary: 'Registrar pago de deuda',
      description: 'Registra un pago. Actualiza `montoPagado` y `estado` automáticamente (`pendiente → parcial → pagada`).',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: Type.Object({
        monto: Type.Number({ minimum: 0.01, example: 150 }),
        fecha: Type.String({ format: 'date', example: '2026-07-01' }),
        nota:  Type.Optional(Type.String({ maxLength: 255 })),
      }),
      response: { 201: PaymentResult('deudaId'), 404: { $ref: 'ErrorResponse' } },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    try {
      return reply.status(201).send(await svc.addDebtPayment(usuarioId, id, req.body as any));
    } catch (err: any) {
      if (err.message === 'DEBT_NOT_FOUND') return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Deuda no encontrada' });
      throw err;
    }
  });

  app.get('/debts/:id/payments', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Receivables'],
      summary: 'Listar pagos de una deuda',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: Type.Object({ data: Type.Array(Type.Object({
        id: Type.String(), deudaId: Type.String(), monto: Type.String(),
        fecha: Type.String(), nota: Type.Union([Type.String(), Type.Null()]), creadoEn: Type.String(),
      })) }), 404: { $ref: 'ErrorResponse' } },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    try {
      return { data: await svc.listDebtPayments(usuarioId, id) };
    } catch (err: any) {
      if (err.message === 'DEBT_NOT_FOUND') return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Deuda no encontrada' });
      throw err;
    }
  });
}
