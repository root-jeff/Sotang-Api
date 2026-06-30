import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { CategoriesService } from './categories.service';

const CategoryResponse = Type.Object({
  id:        Type.String({ format: 'uuid' }),
  usuarioId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  nombre:    Type.String(),
  tipo:      Type.String(),
  color:     Type.String(),
  icono:     Type.Optional(Type.String()),
  activa:    Type.Boolean(),
  esSistema: Type.Boolean(),
  parentId:  Type.Optional(Type.String({ format: 'uuid' })),
  orden:     Type.Number(),
}, { $id: 'CategoryResponse' });

const CreateCategoryBody = Type.Object({
  nombre:    Type.String({ minLength: 1, maxLength: 100, example: 'Supermercado' }),
  tipo:      Type.Union([Type.Literal('ingreso'), Type.Literal('gasto'), Type.Literal('ambos')], { example: 'gasto' }),
  color:     Type.Optional(Type.String({ pattern: '^#[0-9A-Fa-f]{6}$', example: '#f59e0b' })),
  icono:     Type.Optional(Type.String({ maxLength: 50, example: 'shopping-cart' })),
  parentId:  Type.Optional(Type.String({ format: 'uuid', description: 'ID de la categoría padre (para subcategorías)' })),
  orden:     Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
}, { $id: 'CreateCategoryBody' });

export default async function categoriesRoutes(app: FastifyInstance) {
  const svc = new CategoriesService();

  // ── POST / ─────────────────────────────────────────────────────────────────
  app.post('/', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Categories'],
      summary: 'Crear categoría',
      description: 'Crea una categoría personalizada. Las categorías del sistema (`esSistema=true`) no pueden ser modificadas. Se pueden crear subcategorías especificando `parentId`.',
      security: [{ bearerAuth: [] }],
      body: CreateCategoryBody,
      response: {
        201: CategoryResponse,
        404: { $ref: 'ErrorResponse' },
      },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    try {
      const category = await svc.createCategory(usuarioId, req.body as any);
      return reply.status(201).send(category);
    } catch (err: any) {
      if (err.message === 'PARENT_NOT_FOUND') {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Categoría padre no encontrada' });
      }
      throw err;
    }
  });

  // ── GET / ──────────────────────────────────────────────────────────────────
  app.get('/', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Categories'],
      summary: 'Listar categorías',
      description: 'Retorna las categorías del sistema más las categorías personalizadas del usuario autenticado. Ordenadas por sistema primero, luego por `orden` y nombre.',
      security: [{ bearerAuth: [] }],
      response: {
        200: Type.Object({ data: Type.Array(CategoryResponse) }),
      },
    },
  }, async (req) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const data = await svc.listCategories(usuarioId);
    return { data };
  });

  // ── GET /:id ───────────────────────────────────────────────────────────────
  app.get('/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Categories'],
      summary: 'Obtener categoría por ID',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: {
        200: CategoryResponse,
        404: { $ref: 'ErrorResponse' },
      },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const cat = await svc.getCategory(usuarioId, id);
    if (!cat) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Categoría no encontrada' });
    return cat;
  });

  // ── PATCH /:id ─────────────────────────────────────────────────────────────
  app.patch('/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Categories'],
      summary: 'Actualizar categoría',
      description: 'Solo categorías del usuario (no de sistema) pueden ser modificadas.',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: Type.Partial(Type.Object({
        nombre: Type.String({ minLength: 1, maxLength: 100 }),
        color:  Type.String({ pattern: '^#[0-9A-Fa-f]{6}$' }),
        icono:  Type.String({ maxLength: 50 }),
        orden:  Type.Integer({ minimum: 0 }),
      })),
      response: {
        200: CategoryResponse,
        404: { $ref: 'ErrorResponse' },
      },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const updated = await svc.updateCategory(usuarioId, id, req.body as any);
    if (!updated) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Categoría no encontrada o no modificable' });
    return updated;
  });

  // ── DELETE /:id ────────────────────────────────────────────────────────────
  app.delete('/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Categories'],
      summary: 'Desactivar categoría',
      description: 'Soft-delete. Las categorías del sistema no pueden eliminarse. Las transacciones existentes que referencian la categoría se conservan.',
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
    const deleted = await svc.deleteCategory(usuarioId, id);
    if (!deleted) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Categoría no encontrada o no eliminable' });
    return { message: 'Categoría desactivada correctamente' };
  });
}
