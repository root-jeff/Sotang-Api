import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { GoalsService } from './goals.service';

const GoalResponse = Type.Object({
  id:            Type.String({ format: 'uuid' }),
  usuarioId:     Type.String({ format: 'uuid' }),
  nombre:        Type.String(),
  descripcion:   Type.Optional(Type.String()),
  montoObjetivo: Type.String({ example: '7000.00' }),
  montoActual:   Type.String({ example: '1500.00' }),
  moneda:        Type.String({ example: 'USD' }),
  fechaObjetivo: Type.Optional(Type.String({ format: 'date' })),
  completada:    Type.Boolean(),
  color:         Type.String(),
  icono:         Type.Optional(Type.String()),
  porcentaje:    Type.Number({ example: 21.43 }),
  diasRestantes: Type.Union([Type.Number(), Type.Null()], { example: 183 }),
  creadoEn:      Type.String({ format: 'date-time' }),
  actualizadoEn: Type.String({ format: 'date-time' }),
}, { $id: 'GoalResponse' });

const CreateGoalBody = Type.Object({
  nombre:        Type.String({ minLength: 1, maxLength: 100, example: 'Fondo de emergencia' }),
  descripcion:   Type.Optional(Type.String({ maxLength: 500, example: '6 meses de gastos cubiertos' })),
  montoObjetivo: Type.Number({ minimum: 0.01, example: 7000 }),
  moneda:        Type.Optional(Type.String({ minLength: 3, maxLength: 3, default: 'USD', example: 'USD' })),
  fechaObjetivo: Type.Optional(Type.String({ format: 'date', example: '2026-12-31' })),
  color:         Type.Optional(Type.String({ pattern: '^#[0-9A-Fa-f]{6}$', example: '#10b981' })),
  icono:         Type.Optional(Type.String({ maxLength: 50, example: 'shield' })),
}, { $id: 'CreateGoalBody' });

const ContributionResponse = Type.Object({
  id:       Type.String({ format: 'uuid' }),
  metaId:   Type.String({ format: 'uuid' }),
  monto:    Type.String(),
  nota:     Type.Optional(Type.String()),
  fecha:    Type.String({ format: 'date' }),
  creadoEn: Type.String({ format: 'date-time' }),
}, { $id: 'ContributionResponse' });

export default async function goalsRoutes(app: FastifyInstance) {
  const svc = new GoalsService();

  // ── POST / ─────────────────────────────────────────────────────────────────
  app.post('/', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Goals'],
      summary: 'Crear meta de ahorro',
      description: 'Crea una meta de ahorro. El progreso se actualiza automáticamente al registrar aportes.',
      security: [{ bearerAuth: [] }],
      body: CreateGoalBody,
      response: {
        201: GoalResponse,
      },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const goal = await svc.createGoal(usuarioId, req.body as any);
    return reply.status(201).send(goal);
  });

  // ── GET / ──────────────────────────────────────────────────────────────────
  app.get('/', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Goals'],
      summary: 'Listar metas de ahorro',
      description: 'Retorna todas las metas con progreso (`porcentaje`), días restantes y estado de completada. Ordena: activas primero, luego por fecha de creación descendente.',
      security: [{ bearerAuth: [] }],
      response: {
        200: Type.Object({ data: Type.Array(GoalResponse) }),
      },
    },
  }, async (req) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const data = await svc.listGoals(usuarioId);
    return { data };
  });

  // ── GET /:id ───────────────────────────────────────────────────────────────
  app.get('/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Goals'],
      summary: 'Obtener meta por ID',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: {
        200: GoalResponse,
        404: { $ref: 'ErrorResponse' },
      },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const goal = await svc.getGoal(usuarioId, id);
    if (!goal) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Meta no encontrada' });
    return goal;
  });

  // ── PATCH /:id ─────────────────────────────────────────────────────────────
  app.patch('/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Goals'],
      summary: 'Actualizar meta',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: Type.Partial(Type.Object({
        nombre:        Type.String({ minLength: 1, maxLength: 100 }),
        descripcion:   Type.String({ maxLength: 500 }),
        montoObjetivo: Type.Number({ minimum: 0.01 }),
        fechaObjetivo: Type.String({ format: 'date' }),
        color:         Type.String({ pattern: '^#[0-9A-Fa-f]{6}$' }),
        icono:         Type.String({ maxLength: 50 }),
      })),
      response: {
        200: GoalResponse,
        404: { $ref: 'ErrorResponse' },
      },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const updated = await svc.updateGoal(usuarioId, id, req.body as any);
    if (!updated) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Meta no encontrada' });
    return updated;
  });

  // ── DELETE /:id ────────────────────────────────────────────────────────────
  app.delete('/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Goals'],
      summary: 'Eliminar meta',
      description: 'Elimina la meta y todos sus aportes (hard-delete). Esta acción es irreversible.',
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
    const deleted = await svc.deleteGoal(usuarioId, id);
    if (!deleted) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Meta no encontrada' });
    return { message: 'Meta eliminada correctamente' };
  });

  // ── POST /:id/contributions ────────────────────────────────────────────────
  app.post('/:id/contributions', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Goals'],
      summary: 'Registrar aporte a meta',
      description: 'Registra un aporte (positivo o negativo) y actualiza `montoActual`. Si el nuevo total alcanza `montoObjetivo`, la meta se marca como `completada`.',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: Type.Object({
        monto: Type.Number({ description: 'Monto del aporte. Negativo para retirar fondos.', example: 500 }),
        nota:  Type.Optional(Type.String({ maxLength: 255, example: 'Sueldo junio' })),
        fecha: Type.String({ format: 'date', example: '2026-06-29' }),
      }),
      response: {
        201: Type.Object({
          contribution: ContributionResponse,
          completada:   Type.Boolean(),
          montoActual:  Type.String(),
        }),
        404: { $ref: 'ErrorResponse' },
      },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    try {
      const result = await svc.addContribution(usuarioId, id, req.body as any);
      return reply.status(201).send(result);
    } catch (err: any) {
      if (err.message === 'GOAL_NOT_FOUND') {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Meta no encontrada' });
      }
      throw err;
    }
  });

  // ── GET /:id/contributions ─────────────────────────────────────────────────
  app.get('/:id/contributions', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Goals'],
      summary: 'Listar aportes de una meta',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: {
        200: Type.Object({ data: Type.Array(ContributionResponse) }),
        404: { $ref: 'ErrorResponse' },
      },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    try {
      const data = await svc.listContributions(usuarioId, id);
      return { data };
    } catch (err: any) {
      if (err.message === 'GOAL_NOT_FOUND') {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Meta no encontrada' });
      }
      throw err;
    }
  });
}
