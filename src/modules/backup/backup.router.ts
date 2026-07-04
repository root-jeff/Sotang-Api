import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { desc, eq } from 'drizzle-orm';
import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdir, stat } from 'fs/promises';
import path from 'path';
import { getDb } from '../../core/db';
import { backupLog } from '../../db/schema/index';
import { env } from '../../core/config';

const execAsync = promisify(exec);
const BACKUP_DIR = process.env.BACKUP_DIR ?? path.resolve('storage/backups');

export default async function backupRoutes(app: FastifyInstance) {
  app.post('/trigger', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Backup'],
      summary: 'Disparar backup manual de la base de datos',
      description: 'Ejecuta pg_dump comprimido al volumen local. En producción, el CronJob de K3s (0 3 * * *) hace esto mismo y sube el archivo a Google Drive.',
      security: [{ bearerAuth: [] }],
      response: { 202: Type.Object({ id: Type.String(), estado: Type.String() }) },
    },
  }, async (_req, reply) => {
    const db = getDb();
    const [log] = await db.insert(backupLog).values({ tipo: 'db', estado: 'en_progreso' }).returning();

    // Fire-and-forget: el estado queda en backup_log
    void (async () => {
      try {
        await mkdir(BACKUP_DIR, { recursive: true });
        const file = path.join(BACKUP_DIR, `sotang-${new Date().toISOString().slice(0, 10)}-${log.id.slice(0, 8)}.sql.gz`);
        // pg_dump vía el contenedor en dev; en el cluster el binario existe en el pod (PG_DUMP_DOCKER=false)
        const cmd = process.env.PG_DUMP_DOCKER === 'false'
          ? `pg_dump "${env.DATABASE_URL}" | gzip > "${file}"`
          : `docker exec sotang-postgres pg_dump -U sotang sotang_db | gzip > "${file}"`;
        await execAsync(cmd, { maxBuffer: 64 * 1024 * 1024 });
        const { size } = await stat(file);
        await db.update(backupLog).set({ estado: 'exitoso', tamanioBytes: size }).where(eq(backupLog.id, log.id));
      } catch (err: any) {
        await db.update(backupLog).set({ estado: 'fallido', errorMsg: String(err.message).slice(0, 500) }).where(eq(backupLog.id, log.id));
      }
    })();

    return reply.status(202).send({ id: log.id, estado: 'en_progreso' });
  });

  app.get('/history', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Backup'],
      summary: 'Historial de backups',
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const db = getDb();
    const data = await db.select().from(backupLog).orderBy(desc(backupLog.creadoEn)).limit(30);
    return { data };
  });
}
