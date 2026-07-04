import { Worker, type Job } from 'bullmq';
import { redis, QUEUE_NAMES, recurringQueue } from '../core/redis';
import { RecurringService } from '../modules/transactions/recurring.service';
import { InvalidStateError } from '../modules/transactions/recurring-state/index';

// SRP (Técnica 5 del documento): el tick descubre, y cada job ejecuta UNA recurrente.
// Idempotencia: jobId = `${recurrenteId}:${proximaEjecucion}` — BullMQ descarta duplicados,
// y el patrón State rechaza ejecutar dos veces la misma ocurrencia (InvalidStateError).

interface ExecuteJob { recurrenteId: string }

export function createRecurringWorker(svc: RecurringService = new RecurringService()) {
  return new Worker<ExecuteJob | Record<string, never>>(QUEUE_NAMES.recurring, async (job: Job) => {
    if (job.name === 'tick') {
      // 1) Recordatorios D-1 (pending → notified)
      const manana = await svc.findDueTomorrow();
      for (const rec of manana) {
        try { await svc.markNotified(rec.id); } catch (err) {
          if (!(err instanceof InvalidStateError)) throw err;
        }
      }
      // 2) Vencidas hoy: un job idempotente por ocurrencia
      const due = await svc.findDue();
      for (const rec of due) {
        await recurringQueue.add('execute', { recurrenteId: rec.id }, {
          jobId: `exec:${rec.id}:${rec.proximaEjecucion}`,
        });
      }
      return { notificadas: manana.length, encoladas: due.length };
    }

    if (job.name === 'execute') {
      const { recurrenteId } = job.data as ExecuteJob;
      try {
        return await svc.executeOne(recurrenteId);
      } catch (err) {
        // Transición inválida = ocurrencia ya ejecutada por otro camino: no reintentar
        if (err instanceof InvalidStateError) return { skipped: err.message };
        throw err;
      }
    }
  }, { connection: redis, concurrency: 2 });
}

/** Tick repetible cada 15 minutos (repeatable job de BullMQ). */
export async function scheduleRecurringTick() {
  await recurringQueue.add('tick', {}, {
    repeat: { every: 15 * 60 * 1000 },
    jobId: 'recurring-tick',
    removeOnComplete: { count: 10 },
  });
}
