import { Worker, type Job } from 'bullmq';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { redis, QUEUE_NAMES, cache } from '../core/redis';
import { getDb } from '../core/db';
import { transactions, categories, accounts } from '../db/schema/index';

export interface ReportJob {
  usuarioId: string;
  tipo: 'transacciones-csv' | 'resumen-mensual-json';
  desde: string;
  hasta: string;
}

export const REPORTS_DIR = process.env.REPORTS_DIR ?? path.resolve('storage/reports');

export const reportStatusKey = (jobId: string) => `report:${jobId}`;

// Genera el archivo de forma asíncrona; el estado se consulta por jobId (RF-49)
export function createReportsWorker() {
  return new Worker<ReportJob>(QUEUE_NAMES.reports, async (job: Job<ReportJob>) => {
    const db = getDb();
    const { usuarioId, tipo, desde, hasta } = job.data;
    await cache.set(reportStatusKey(job.id!), JSON.stringify({ estado: 'procesando' }), 'EX', 3600);

    const rows = await db.select({
      fecha: transactions.fecha,
      tipo: transactions.tipo,
      descripcion: transactions.descripcion,
      monto: transactions.monto,
      montoTotal: transactions.montoTotal,
      ivaMonto: transactions.ivaMonto,
      modoIva: transactions.modoIva,
      categoria: categories.nombre,
      cuenta: accounts.nombre,
      estado: transactions.estado,
    })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoriaId, categories.id))
      .leftJoin(accounts, eq(transactions.cuentaId, accounts.id))
      .where(and(
        eq(transactions.usuarioId, usuarioId),
        gte(transactions.fecha, desde),
        lte(transactions.fecha, hasta),
      ))
      .orderBy(desc(transactions.fecha));

    await mkdir(REPORTS_DIR, { recursive: true });
    let filename: string;

    if (tipo === 'transacciones-csv') {
      filename = `${job.id}.csv`;
      const header = 'fecha,tipo,descripcion,monto,monto_total,iva,modo_iva,categoria,cuenta,estado';
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = rows.map(r =>
        [r.fecha, r.tipo, esc(r.descripcion), r.monto, r.montoTotal, r.ivaMonto ?? '', r.modoIva, esc(r.categoria), esc(r.cuenta), r.estado].join(','));
      await writeFile(path.join(REPORTS_DIR, filename), '﻿' + [header, ...lines].join('\n'), 'utf-8');
    } else {
      filename = `${job.id}.json`;
      const resumen = {
        periodo: { desde, hasta },
        totales: rows.reduce((acc, r) => {
          acc[r.tipo] = (acc[r.tipo] ?? 0) + parseFloat(r.montoTotal);
          return acc;
        }, {} as Record<string, number>),
        ivaTotal: rows.reduce((s, r) => s + parseFloat(r.ivaMonto ?? '0'), 0),
        transacciones: rows,
      };
      await writeFile(path.join(REPORTS_DIR, filename), JSON.stringify(resumen, null, 2), 'utf-8');
    }

    await cache.set(reportStatusKey(job.id!), JSON.stringify({
      estado: 'listo', filename, registros: rows.length,
    }), 'EX', 3600);
    return { filename, registros: rows.length };
  }, { connection: redis, concurrency: 2 });
}
