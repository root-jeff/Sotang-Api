import type { FastifyInstance } from 'fastify';
import { DashboardService } from './dashboard.service';

export default async function dashboardRoutes(app: FastifyInstance) {
  const svc = new DashboardService();

  app.get('/', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Dashboard'],
      summary: 'Dashboard consolidado',
      description: 'Widgets: liquidez, balance del mes, presupuestos con ejecución, metas, cobros/deudas, patrimonio neto, próximas recurrentes y últimas transacciones. Cache Redis TTL 5 min, invalidada al registrar cualquier transacción (el campo `cache` indica si la respuesta vino de Redis).',
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    const usuarioId = (req.user as { sub: string }).sub;
    return svc.getDashboard(usuarioId);
  });
}
