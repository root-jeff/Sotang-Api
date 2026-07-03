import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import { AccountsService } from "./accounts.service";
import { CreateAccountBody, AccountResponse } from "./accounts.schema";

export default async function accountsRoutes(app: FastifyInstance) {
  const svc = new AccountsService();

  // ── POST / ─────────────────────────────────────────────────────────────────
  app.post(
    "/",
    {
      preHandler: [app.verifyJWT],
      schema: {
        tags: ["Accounts"],
        summary: "Crear cuenta",
        description: `Crea una cuenta del usuario autenticado.

Según el tipo de cuenta se espera un sub-objeto adicional:
- **tarjeta_credito** → campo \`tarjeta\` (obligatorio)
- **cripto** → campo \`cripto\` (obligatorio)
- **ahorro_virtual** → campo \`ahorroVirtual\` (obligatorio, referencia a cuenta real existente)`,
        security: [{ bearerAuth: [] }],
        body: CreateAccountBody,
        response: {
          201: AccountResponse,
          400: { $ref: "ErrorResponse" },
          404: { $ref: "ErrorResponse" },
        },
      },
    },
    async (req, reply) => {
      const usuarioId = (req.user as { sub: string }).sub;
      try {
        const account = await svc.createAccount(usuarioId, req.body as any);
        return reply.status(201).send(account);
      } catch (err: any) {
        if (err.message === "PARENT_NOT_FOUND") {
          return reply
            .status(404)
            .send({
              statusCode: 404,
              error: "Not Found",
              message: "Cuenta padre no encontrada o no pertenece al usuario",
            });
        }
        throw err;
      }
    },
  );

  // ── GET / ──────────────────────────────────────────────────────────────────
  app.get(
    "/",
    {
      preHandler: [app.verifyJWT],
      schema: {
        tags: ["Accounts"],
        summary: "Listar cuentas",
        description:
          "Retorna todas las cuentas activas del usuario autenticado, ordenadas por `orden` y luego alfabéticamente.",
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Object({
            data: Type.Array(AccountResponse),
          }),
        },
      },
    },
    async (req) => {
      const usuarioId = (req.user as { sub: string }).sub;
      const data = await svc.listAccounts(usuarioId);
      return { data };
    },
  );

  // ── GET /summary ───────────────────────────────────────────────────────────
  app.get(
    "/summary",
    {
      preHandler: [app.verifyJWT],
      schema: {
        tags: ["Accounts"],
        summary: "Resumen financiero",
        description:
          "Saldo total en USD (cuentas con `incluirEnTotal=true`) y desglose por tipo de cuenta.",
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Object({
            totalUsd: Type.Number({ example: 3450.75 }),
            byType: Type.Record(Type.String(), Type.Number()),
            cuentas: Type.Number({ example: 5 }),
          }),
        },
      },
    },
    async (req) => {
      const usuarioId = (req.user as { sub: string }).sub;
      return svc.getSummary(usuarioId);
    },
  );

  // ── GET /:id ───────────────────────────────────────────────────────────────
  app.get(
    "/:id",
    {
      preHandler: [app.verifyJWT],
      schema: {
        tags: ["Accounts"],
        summary: "Obtener cuenta por ID",
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.String({ format: "uuid" }) }),
        response: {
          200: AccountResponse,
          404: { $ref: "ErrorResponse" },
        },
      },
    },
    async (req, reply) => {
      const usuarioId = (req.user as { sub: string }).sub;
      const { id } = req.params as { id: string };
      const account = await svc.getAccount(usuarioId, id);
      if (!account)
        return reply
          .status(404)
          .send({
            statusCode: 404,
            error: "Not Found",
            message: "Cuenta no encontrada",
          });
      return account;
    },
  );

  // ── PATCH /:id ─────────────────────────────────────────────────────────────
  app.patch(
    "/:id",
    {
      preHandler: [app.verifyJWT],
      schema: {
        tags: ["Accounts"],
        summary: "Actualizar cuenta",
        description:
          "Permite modificar nombre, color, icono, notas, orden e `incluirEnTotal`. El tipo y moneda no son modificables.",
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.String({ format: "uuid" }) }),
        body: Type.Partial(
          Type.Object({
            nombre: Type.String({ minLength: 1, maxLength: 100 }),
            color: Type.String({ pattern: "^#[0-9A-Fa-f]{6}$" }),
            icono: Type.String({ maxLength: 50 }),
            incluirEnTotal: Type.Boolean(),
            orden: Type.Integer({ minimum: 0 }),
            notas: Type.String({ maxLength: 500 }),
          }),
        ),
        response: {
          200: AccountResponse,
          404: { $ref: "ErrorResponse" },
        },
      },
    },
    async (req, reply) => {
      const usuarioId = (req.user as { sub: string }).sub;
      const { id } = req.params as { id: string };
      const updated = await svc.updateAccount(usuarioId, id, req.body as any);
      if (!updated)
        return reply
          .status(404)
          .send({
            statusCode: 404,
            error: "Not Found",
            message: "Cuenta no encontrada",
          });
      return updated;
    },
  );

  // ── DELETE /:id ────────────────────────────────────────────────────────────
  app.delete(
    "/:id",
    {
      preHandler: [app.verifyJWT],
      schema: {
        tags: ["Accounts"],
        summary: "Desactivar cuenta",
        description:
          "Soft-delete: marca la cuenta como inactiva (`activa = false`). Los datos históricos se conservan.",
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.String({ format: "uuid" }) }),
        response: {
          200: Type.Object({ message: Type.String() }),
          404: { $ref: "ErrorResponse" },
        },
      },
    },
    async (req, reply) => {
      const usuarioId = (req.user as { sub: string }).sub;
      const { id } = req.params as { id: string };
      const deleted = await svc.deleteAccount(usuarioId, id);
      if (!deleted)
        return reply
          .status(404)
          .send({
            statusCode: 404,
            error: "Not Found",
            message: "Cuenta no encontrada",
          });
      return { message: "Cuenta desactivada correctamente" };
    },
  );
}
