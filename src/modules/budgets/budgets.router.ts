import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { BudgetsService } from './budgets.service';

const BudgetResponse = Type.Object({
  id:          Type.String({ format: 'uuid' }),
  usuarioId:   Type.String({ format: 'uuid' }),
  categoriaId: Type.String({ format: 'uuid' }),
  nombre:      Type.String(),
  monto:       Type.String(),
  periodo:     Type.String(),
  fechaInicio: Type.String(),
  fechaFin:    Type.Optional(Type.String()),
  activo:      Type.Boolean(),
  creadoEn:    Type.String({ format: 'date-time' }),
}, { $id: 'BudgetResponse' });

const BudgetWithStatusResponse = Type.Intersect([
  BudgetResponse,
  Type.Object({
    gastoActual: Type.String({ example: '340.50' }),
    porcentaje:  Type.Number({ example: 68.1 }),
    enAlerta:    Type.Boolean({ description: '≥ 80% del límite consumido' }),
    excedido:    Type.Boolean({ description: '≥ 100% del límite consumido' }),
  }),
], { $id: 'BudgetWithStatusResponse' });

const CreateBudgetBody = Type.Object({
  categoriaId: Type.String({ format: 'uuid', description: 'ID de la categoría a presupuestar' }),
  nombre:      Type.String({ minLength: 1, maxLength: 100, example: 'Alimentación mensual' }),
  monto:       Type.Number({ minimum: 0.01, example: 500 }),
  periodo:     Type.Optional(Type.Union([
    Type.Literal('semanal'),
    Type.Literal('mensual'),
    Type.Literal('anual'),
  ], { default: 'mensual' })),
  fechaInicio: Type.String({ format: 'date', example: '2026-06-01', description: 'Inicio del período (YYYY-MM-DD)' }),
  fechaFin:    Type.Optional(Type.String({ format: 'date', example: '2026-06-30', description: 'Fin del período (omitir para abierto)' })),
}, { $id: 'CreateBudgetBody' });

export default async function budgetsRoutes(app: FastifyInstance) {
  const svc = new BudgetsService();

  // ── POST / ─────────────────────────────────────────────────────────────────
  app.post('/', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Budgets'],
      summary: 'Crear presupuesto',
      description: 'Crea un presupuesto por categoría y período. El gasto real se calcula comparando las transacciones de tipo `gasto` en la categoría dentro del rango de fechas.',
      security: [{ bearerAuth: [] }],
      body: CreateBudgetBody,
      response: {
        201: BudgetResponse,
      },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const budget = await svc.createBudget(usuarioId, req.body as any);
    return reply.status(201).send(budget);
  });

  // ── GET / ──────────────────────────────────────────────────────────────────
  app.get('/', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Budgets'],
      summary: 'Listar presupuestos activos',
      description: 'Retorna presupuestos con su estado actual: monto gastado, porcentaje y banderas `enAlerta` (≥80%) y `excedido` (≥100%).',
      security: [{ bearerAuth: [] }],
      response: {
        200: Type.Object({ data: Type.Array(BudgetWithStatusResponse) }),
      },
    },
  }, async (req) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const data = await svc.listBudgets(usuarioId);
    return { data };
  });

  // ── GET /current-status ────────────────────────────────────────────────────
  app.get('/current-status', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Budgets'],
      summary: 'Estado del mes actual',
      description: 'Resumen consolidado de todos los presupuestos mensuales para el mes en curso. Incluye total presupuestado vs. gastado.',
      security: [{ bearerAuth: [] }],
      response: {
        200: Type.Object({
          mes:               Type.String({ example: '2026-06' }),
          totalPresupuestado: Type.Number({ example: 1500 }),
          totalGastado:      Type.Number({ example: 940.25 }),
          presupuestos:      Type.Array(Type.Object({
            id:          Type.String({ format: 'uuid' }),
            nombre:      Type.String(),
            categoriaId: Type.String({ format: 'uuid' }),
            monto:       Type.String(),
            gastoActual: Type.String(),
            porcentaje:  Type.Number(),
            enAlerta:    Type.Boolean(),
            excedido:    Type.Boolean(),
          })),
        }),
      },
    },
  }, async (req) => {
    const usuarioId = (req.user as { sub: string }).sub;
    return svc.getCurrentStatus(usuarioId);
  });

  // ── GET /:id ───────────────────────────────────────────────────────────────
  app.get('/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Budgets'],
      summary: 'Obtener presupuesto por ID',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: {
        200: BudgetResponse,
        404: { $ref: 'ErrorResponse' },
      },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const budget = await svc.getBudget(usuarioId, id);
    if (!budget) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Presupuesto no encontrado' });
    return budget;
  });

  // ── PATCH /:id ─────────────────────────────────────────────────────────────
  app.patch('/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Budgets'],
      summary: 'Actualizar presupuesto',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: Type.Partial(Type.Object({
        nombre:      Type.String({ minLength: 1, maxLength: 100 }),
        monto:       Type.Number({ minimum: 0.01 }),
        periodo:     Type.Union([Type.Literal('semanal'), Type.Literal('mensual'), Type.Literal('anual')]),
        fechaInicio: Type.String({ format: 'date' }),
        fechaFin:    Type.String({ format: 'date' }),
      })),
      response: {
        200: BudgetResponse,
        404: { $ref: 'ErrorResponse' },
      },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const updated = await svc.updateBudget(usuarioId, id, req.body as any);
    if (!updated) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Presupuesto no encontrado' });
    return updated;
  });

  // ── DELETE /:id ────────────────────────────────────────────────────────────
  app.delete('/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Budgets'],
      summary: 'Desactivar presupuesto',
      description: 'Soft-delete: marca el presupuesto como inactivo.',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: {
        200: Type.Object({ message: Type.String() }),
        404: { $ref: 'ErrorResponse' },
      },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const deleted = await svc.deleteBudget(usuarioId, id);
    if (!deleted) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Presupuesto no encontrado' });
    return { message: 'Presupuesto desactivado correctamente' };
  });
}
