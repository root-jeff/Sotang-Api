import { createNotificationsWorker } from './notifications.worker';
import { createBudgetAlertsWorker } from './budget-alerts.worker';
import { createRecurringWorker, scheduleRecurringTick } from './recurring-txn.worker';
import { createReportsWorker } from './reports.worker';

// Entrypoint de los workers BullMQ (proceso separado del API: npm run dev:workers)
async function main() {
  const workers = [
    createNotificationsWorker(),
    createBudgetAlertsWorker(),
    createRecurringWorker(),
    createReportsWorker(),
  ];

  await scheduleRecurringTick();

  for (const w of workers) {
    w.on('failed', (job, err) => console.error(`[${w.name}] job ${job?.id} falló:`, err.message));
    w.on('completed', (job) => console.log(`[${w.name}] job ${job.name}:${job.id} completado`));
  }

  console.log(`🔄 Workers activos: ${workers.map(w => w.name).join(', ')}`);
  console.log('⏰ Tick de recurrentes programado cada 15 minutos');

  const shutdown = async () => {
    console.log('Cerrando workers...');
    await Promise.all(workers.map(w => w.close()));
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => { console.error(err); process.exit(1); });
