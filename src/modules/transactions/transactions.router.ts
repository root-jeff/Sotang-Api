import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { TransactionsService } from './transactions.service';
import {
  CreateTransactionBody,
  TransactionResponse,
  ListTransactionsQuery,
} from './transactions.schema';

export default async function transactionsRoutes(app: FastifyInstance) {
  const svc = new TransactionsService();

  // ── POST / ─────────────────────────────────────────────────────────────────
  app.post('/', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Transactions'],
      summary: 'Crear transacción',
      description: `Crea un ingreso, gasto o transferencia y actualiza el saldo de la(s) cuenta(s) en la misma transacción DB.

**Reglas:**
- \`tipo=transferencia\` requiere \`cuentaDestinoId\` (y no admite IVA)
- \`modoIva=incluido\`: el monto ya trae IVA y se desglosa (neto = monto/1.15; total = monto)
- \`modoIva=adicional\` ("Aplica IVA"): el monto es la base y el IVA se suma encima (total = monto*1.15 — ej. Steam: base $59.00 → cargo real $67.85)
- El saldo/cupo se afecta SIEMPRE por \`montoTotal\` (\`incluyeIva=true\` legado equivale a \`modoIva=incluido\`)
- Solo transacciones con \`estado=completada\` afectan el saldo
- \`etiquetas\` es un array de UUIDs de etiquetas existentes`,
      security: [{ bearerAuth: [] }],
      body: CreateTransactionBody,
      response: {
        201: TransactionResponse,
        400: { $ref: 'ErrorResponse' },
        404: { $ref: 'ErrorResponse' },
      },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    try {
      const txn = await svc.createTransaction(usuarioId, req.body as any);
      return reply.status(201).send(txn);
    } catch (err: any) {
      const map: Record<string, [number, string]> = {
        ACCOUNT_NOT_FOUND:    [404, 'Cuenta origen no encontrada'],
        DEST_ACCOUNT_NOT_FOUND: [404, 'Cuenta destino no encontrada'],
        TRANSFER_NEEDS_DEST:  [400, 'Transferencias requieren cuentaDestinoId'],
        IVA_NOT_ALLOWED_ON_TRANSFER: [400, 'Las transferencias no admiten cálculo de IVA'],
      };
      const [code, msg] = map[err.message] ?? [500, err.message];
      return reply.status(code).send({ statusCode: code, error: err.message, message: msg });
    }
  });

  // ── GET / ──────────────────────────────────────────────────────────────────
  app.get('/', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Transactions'],
      summary: 'Listar transacciones',
      description: 'Retorna transacciones paginadas con filtros opcionales. Ordenadas por fecha descendente.',
      security: [{ bearerAuth: [] }],
      querystring: ListTransactionsQuery,
      response: {
        200: Type.Object({
          data:  Type.Array(TransactionResponse),
          total: Type.Number({ example: 145 }),
          page:  Type.Number({ example: 1 }),
          limit: Type.Number({ example: 30 }),
          pages: Type.Number({ example: 5 }),
        }),
      },
    },
  }, async (req) => {
    const usuarioId = (req.user as { sub: string }).sub;
    return svc.listTransactions(usuarioId, req.query as any);
  });

  // ── GET /summary ───────────────────────────────────────────────────────────
  app.get('/summary', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Transactions'],
      summary: 'Resumen mensual',
      description: 'Total de ingresos, gastos y balance neto para el mes indicado. Solo considera transacciones `completadas`.',
      security: [{ bearerAuth: [] }],
      querystring: Type.Object({
        year:  Type.Optional(Type.Integer({ minimum: 2020, maximum: 2100, description: 'Año (default: año actual)' })),
        month: Type.Optional(Type.Integer({ minimum: 1, maximum: 12,    description: 'Mes 1-12 (default: mes actual)' })),
      }),
      response: {
        200: Type.Object({
          periodo:       Type.String({ example: '2026-06' }),
          ingreso:       Type.Number({ example: 2500 }),
          gasto:         Type.Number({ example: 1340.75 }),
          transferencia: Type.Number({ example: 200 }),
          balance:       Type.Number({ example: 1159.25 }),
        }),
      },
    },
  }, async (req) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const now = new Date();
    const { year = now.getFullYear(), month = now.getMonth() + 1 } = req.query as any;
    return svc.getMonthlySummary(usuarioId, year, month);
  });

  // ── GET /:id ───────────────────────────────────────────────────────────────
  app.get('/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Transactions'],
      summary: 'Obtener transacción por ID',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: {
        200: TransactionResponse,
        404: { $ref: 'ErrorResponse' },
      },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const txn = await svc.getTransaction(usuarioId, id);
    if (!txn) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Transacción no encontrada' });
    return txn;
  });

  // ── PATCH /:id ─────────────────────────────────────────────────────────────
  app.patch('/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Transactions'],
      summary: 'Actualizar transacción',
      description: 'Permite editar descripción, notas, fecha y estado. Cambiar estado a `anulada` revierte automáticamente el saldo de la cuenta.',
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: Type.Partial(Type.Object({
        descripcion: Type.String({ maxLength: 500 }),
        notas:       Type.String({ maxLength: 2000 }),
        fecha:       Type.String({ format: 'date' }),
        estado:      Type.Union([
          Type.Literal('completada'),
          Type.Literal('pendiente'),
          Type.Literal('en_proceso'),
          Type.Literal('anulada'),
        ]),
      })),
      response: {
        200: TransactionResponse,
        404: { $ref: 'ErrorResponse' },
      },
    },
  }, async (req, reply) => {
    const usuarioId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const updated = await svc.updateTransaction(usuarioId, id, req.body as any);
    if (!updated) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Transacción no encontrada' });
    return updated;
  });

  // ── DELETE /:id ────────────────────────────────────────────────────────────
  app.delete('/:id', {
    preHandler: [app.verifyJWT],
    schema: {
      tags: ['Transactions'],
      summary: 'Eliminar transacción',
      description: 'Hard-delete. Revierte el saldo de la cuenta si la transacción estaba `completada`.',
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
    const deleted = await svc.deleteTransaction(usuarioId, id);
    if (!deleted) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Transacción no encontrada' });
    return { message: 'Transacción eliminada correctamente' };
  });
}
