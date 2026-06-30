import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { PatrimonyService } from './patrimony.service';

const AssetTipos = Type.Union([
  Type.Literal('inmueble'), Type.Literal('vehiculo'), Type.Literal('electronico'),
  Type.Literal('inversion'), Type.Literal('cripto'), Type.Literal('otro'),
]);

const LiabilityTipos = Type.Union([
  Type.Literal('hipoteca'), Type.Literal('prestamo_personal'),
  Type.Literal('prestamo_auto'), Type.Literal('credito_educativo'), Type.Literal('otro'),
]);

const AssetResponse = Type.Object({
  id:            Type.String({ format: 'uuid' }),
  usuarioId:     Type.String({ format: 'uuid' }),
  nombre:        Type.String(),
  tipo:          Type.String(),
  valorActual:   Type.String(),
  moneda:        Type.String(),
  descripcion:   Type.Union([Type.String(), Type.Null()]),
  fechaAdquis:   Type.Union([Type.String(), Type.Null()]),
  creadoEn:      Type.String({ format: 'date-time' }),
  actualizadoEn: Type.String({ format: 'date-time' }),
}, { $id: 'AssetResponse' });

const LiabilityResponse = Type.Object({
  id:            Type.String({ format: 'uuid' }),
  usuarioId:     Type.String({ format: 'uuid' }),
  nombre:        Type.String(),
  tipo:          Type.String(),
  saldoActual:   Type.String(),
  cuotaMensual:  Type.Union([Type.String(), Type.Null()]),
  tasaAnual:     Type.Union([Type.String(), Type.Null()]),
  fechaInicio:   Type.Union([Type.String(), Type.Null()]),
  fechaFin:      Type.Union([Type.String(), Type.Null()]),
  entidad:       Type.Union([Type.String(), Type.Null()]),
  descripcion:   Type.Union([Type.String(), Type.Null()]),
  creadoEn:      Type.String({ format: 'date-time' }),
  actualizadoEn: Type.String({ format: 'date-time' }),
}, { $id: 'LiabilityResponse' });

export default async function patrimonyRoutes(app: FastifyInstance) {
  const svc = new PatrimonyService();

  // ────────────────────────────────────────────────────────────────────────────
  // NET WORTH
  // ────────────────────────────────────────────────────────────────────────────
  app.get('/net-worth', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Patrimony'],
      summary: 'Patrimonio neto',
      description: 'Calcula activos totales − pasivos totales = patrimonio neto, desglosado por tipo.',
      security: [{ bearerAuth: [] }],
      response: {
        200: Type.Object({
          totalActivos:   Type.Number({ example: 52000 }),
          totalPasivos:   Type.Number({ example: 18000 }),
          patrimonioNeto: Type.Number({ example: 34000 }),
          activosPorTipo:  Type.Record(Type.String(), Type.Number()),
          pasivosPorTipo:  Type.Record(Type.String(), Type.Number()),
          calculadoEn:    Type.String({ format: 'date-time' }),
        }),
      },
    },
  }, async (req) => {
    const usuarioId = (req.user as { sub: string }).sub;
    return svc.getNetWorth(usuarioId);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // ASSETS
  // ────────────────────────────────────────────────────────────────────────────
  app.post('/assets', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Patrimony'],
      summary: 'Registrar activo',
      security: [{ bearerAuth: [] }],
      body: Type.Object({
        nombre:      Type.String({ minLength: 1, maxLength: 100, example: 'Apartamento Urdesa' }),
        tipo:        AssetTipos,
        valorActual: Type.Number({ minimum: 0, example: 45000 }),
        moneda:      Type.Optional(Type.String({ minLength: 3, maxLength: 3, default: 'USD' })),
        descripcion: Type.Optional(Type.String({ maxLength: 500 })),
        fechaAdquis: Type.Optional(Type.String({ format: 'date', example: '2022-03-15' })),
      }),
      response: { 201: AssetResponse },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const asset = await svc.createAsset(usuarioId, req.body as any);
    return reply.status(201).send(asset);
  });

  app.get('/assets', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Patrimony'],
      summary: 'Listar activos',
      security: [{ bearerAuth: [] }],
      response: { 200: Type.Object({ data: Type.Array(AssetResponse) }) },
    },
  }, async (req) => {
    const usuarioId = (req.user as { sub: string }).sub;
    return { data: await svc.listAssets(usuarioId) };
  });

  app.get('/assets/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Patrimony'],
      summary: 'Obtener activo por ID',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: AssetResponse, 404: { $ref: 'ErrorResponse' } },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const asset = await svc.getAsset(usuarioId, id);
    if (!asset) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Activo no encontrado' });
    return asset;
  });

  app.patch('/assets/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Patrimony'],
      summary: 'Actualizar activo',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: Type.Partial(Type.Object({
        nombre:      Type.String({ minLength: 1, maxLength: 100 }),
        valorActual: Type.Number({ minimum: 0 }),
        descripcion: Type.String({ maxLength: 500 }),
        fechaAdquis: Type.String({ format: 'date' }),
      })),
      response: { 200: AssetResponse, 404: { $ref: 'ErrorResponse' } },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const updated = await svc.updateAsset(usuarioId, id, req.body as any);
    if (!updated) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Activo no encontrado' });
    return updated;
  });

  app.delete('/assets/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Patrimony'],
      summary: 'Eliminar activo',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: Type.Object({ message: Type.String() }), 404: { $ref: 'ErrorResponse' } },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const deleted = await svc.deleteAsset(usuarioId, id);
    if (!deleted) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Activo no encontrado' });
    return { message: 'Activo eliminado' };
  });

  // ────────────────────────────────────────────────────────────────────────────
  // LIABILITIES
  // ────────────────────────────────────────────────────────────────────────────
  app.post('/liabilities', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Patrimony'],
      summary: 'Registrar pasivo',
      security: [{ bearerAuth: [] }],
      body: Type.Object({
        nombre:       Type.String({ minLength: 1, maxLength: 100, example: 'Préstamo auto Pichincha' }),
        tipo:         LiabilityTipos,
        saldoActual:  Type.Number({ minimum: 0, example: 8500 }),
        cuotaMensual: Type.Optional(Type.Number({ minimum: 0, example: 350 })),
        tasaAnual:    Type.Optional(Type.Number({ minimum: 0, example: 9.5 })),
        fechaInicio:  Type.Optional(Type.String({ format: 'date' })),
        fechaFin:     Type.Optional(Type.String({ format: 'date' })),
        entidad:      Type.Optional(Type.String({ maxLength: 100, example: 'Banco Pichincha' })),
        descripcion:  Type.Optional(Type.String({ maxLength: 500 })),
      }),
      response: { 201: LiabilityResponse },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const liability = await svc.createLiability(usuarioId, req.body as any);
    return reply.status(201).send(liability);
  });

  app.get('/liabilities', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Patrimony'],
      summary: 'Listar pasivos',
      security: [{ bearerAuth: [] }],
      response: { 200: Type.Object({ data: Type.Array(LiabilityResponse) }) },
    },
  }, async (req) => {
    const usuarioId = (req.user as { sub: string }).sub;
    return { data: await svc.listLiabilities(usuarioId) };
  });

  app.get('/liabilities/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Patrimony'],
      summary: 'Obtener pasivo por ID',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: LiabilityResponse, 404: { $ref: 'ErrorResponse' } },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const l = await svc.getLiability(usuarioId, id);
    if (!l) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Pasivo no encontrado' });
    return l;
  });

  app.patch('/liabilities/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Patrimony'],
      summary: 'Actualizar pasivo',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: Type.Partial(Type.Object({
        nombre:       Type.String({ minLength: 1, maxLength: 100 }),
        saldoActual:  Type.Number({ minimum: 0 }),
        cuotaMensual: Type.Number({ minimum: 0 }),
        tasaAnual:    Type.Number({ minimum: 0 }),
        entidad:      Type.String({ maxLength: 100 }),
        descripcion:  Type.String({ maxLength: 500 }),
        fechaFin:     Type.String({ format: 'date' }),
      })),
      response: { 200: LiabilityResponse, 404: { $ref: 'ErrorResponse' } },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const updated = await svc.updateLiability(usuarioId, id, req.body as any);
    if (!updated) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Pasivo no encontrado' });
    return updated;
  });

  app.delete('/liabilities/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Patrimony'],
      summary: 'Eliminar pasivo',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: Type.Object({ message: Type.String() }), 404: { $ref: 'ErrorResponse' } },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const deleted = await svc.deleteLiability(usuarioId, id);
    if (!deleted) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Pasivo no encontrado' });
    return { message: 'Pasivo eliminado' };
  });

  // ────────────────────────────────────────────────────────────────────────────
  // EQUIFAX REPORTS
  // ────────────────────────────────────────────────────────────────────────────
  app.post('/equifax', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Patrimony'],
      summary: 'Registrar reporte Equifax',
      description: 'Guarda un snapshot del reporte Equifax con score, capacidad de pago y deuda total.',
      security: [{ bearerAuth: [] }],
      body: Type.Object({
        score:          Type.Integer({ minimum: 0, maximum: 999, example: 780 }),
        capacidadPago:  Type.Optional(Type.Number({ minimum: 0, example: 1200 })),
        deudaTotal:     Type.Optional(Type.Number({ minimum: 0, example: 8500 })),
        fechaConsulta:  Type.String({ format: 'date', example: '2026-06-29' }),
        rawJson:        Type.String({ description: 'JSON completo del reporte Equifax para referencia' }),
      }),
      response: {
        201: Type.Object({
          id: Type.String({ format: 'uuid' }),
          score: Type.Number(),
          capacidadPago: Type.Union([Type.String(), Type.Null()]),
          deudaTotal:    Type.Union([Type.String(), Type.Null()]),
          fechaConsulta: Type.String(),
          creadoEn:      Type.String({ format: 'date-time' }),
        }),
      },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const report = await svc.createEquifaxReport(usuarioId, req.body as any);
    return reply.status(201).send(report);
  });

  app.get('/equifax', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Patrimony'],
      summary: 'Historial de reportes Equifax',
      description: 'Lista todos los snapshots guardados, sin el rawJson (solo metadata). Ordenados por fecha descendente.',
      security: [{ bearerAuth: [] }],
      response: {
        200: Type.Object({
          data: Type.Array(Type.Object({
            id:            Type.String({ format: 'uuid' }),
            score:         Type.Number(),
            capacidadPago: Type.Union([Type.String(), Type.Null()]),
            deudaTotal:    Type.Union([Type.String(), Type.Null()]),
            fechaConsulta: Type.String(),
            creadoEn:      Type.String({ format: 'date-time' }),
          })),
        }),
      },
    },
  }, async (req) => {
    const usuarioId = (req.user as { sub: string }).sub;
    return { data: await svc.listEquifaxReports(usuarioId) };
  });
}
