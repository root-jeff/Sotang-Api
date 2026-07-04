import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import path from 'path';
import { createReadStream, existsSync } from 'fs';
import { reportsQueue, cache } from '../../core/redis';
import { reportStatusKey, REPORTS_DIR } from '../../workers/reports.worker';

const CreateReportBody = Type.Object({
  tipo:  Type.Union([Type.Literal('transacciones-csv'), Type.Literal('resumen-mensual-json')]),
  desde: Type.String({ format: 'date' }),
  hasta: Type.String({ format: 'date' }),
});

// RF-49: generación asíncrona — el cliente recibe un jobId y consulta el estado hasta descargar
export default async function reportsRoutes(app: FastifyInstance) {
  app.post('/', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Reports'],
      summary: 'Solicitar un reporte (asíncrono)',
      description: 'Encola la generación y retorna un `jobId`. Consultar `GET /reports/{jobId}` hasta `estado: listo` y descargar en `GET /reports/{jobId}/download`.',
      security: [{ bearerAuth: [] }],
      body: CreateReportBody,
      response: { 202: Type.Object({ jobId: Type.String(), estado: Type.String() }) },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const body = req.body as { tipo: string; desde: string; hasta: string };
    const job = await reportsQueue.add('generate', { usuarioId, ...body });
    await cache.set(reportStatusKey(job.id!), JSON.stringify({ estado: 'encolado' }), 'EX', 3600);
    // Guardar el dueño del job para autorizar la descarga
    await cache.set(`report-owner:${job.id}`, usuarioId, 'EX', 3600);
    return reply.status(202).send({ jobId: job.id, estado: 'encolado' });
  });

  app.get('/:jobId', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Reports'],
      summary: 'Estado de un reporte',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ jobId: Type.String() }),
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { jobId } = req.params as { jobId: string };
    const owner = await cache.get(`report-owner:${jobId}`);
    if (owner !== usuarioId) return reply.status(404).send({ statusCode: 404, error: 'NOT_FOUND', message: 'Reporte no encontrado' });
    const raw = await cache.get(reportStatusKey(jobId));
    return raw ? JSON.parse(raw) : { estado: 'desconocido' };
  });

  app.get('/:jobId/download', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Reports'],
      summary: 'Descargar el archivo del reporte',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ jobId: Type.String() }),
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { jobId } = req.params as { jobId: string };
    const owner = await cache.get(`report-owner:${jobId}`);
    if (owner !== usuarioId) return reply.status(404).send({ statusCode: 404, error: 'NOT_FOUND', message: 'Reporte no encontrado' });

    const raw = await cache.get(reportStatusKey(jobId));
    const status = raw ? JSON.parse(raw) : null;
    if (!status || status.estado !== 'listo') {
      return reply.status(409).send({ statusCode: 409, error: 'NOT_READY', message: `El reporte está en estado: ${status?.estado ?? 'desconocido'}` });
    }
    const filePath = path.join(REPORTS_DIR, path.basename(status.filename));
    if (!existsSync(filePath)) {
      return reply.status(410).send({ statusCode: 410, error: 'EXPIRED', message: 'El archivo del reporte ya no está disponible' });
    }
    const isCsv = filePath.endsWith('.csv');
    reply.header('Content-Type', isCsv ? 'text/csv; charset=utf-8' : 'application/json');
    reply.header('Content-Disposition', `attachment; filename="${status.filename}"`);
    return reply.send(createReadStream(filePath));
  });
}
