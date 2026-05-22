import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { loginSchema, registerSchema } from '@matumailer/shared';
import {
  MatuAuthError,
  matuRecoverPassword,
  matuSignIn,
  matuSignUp,
  syncAppUser,
  usersRepo,
} from '@matumailer/database';
import { z } from 'zod';

export async function authRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    '/register',
    {
      schema: { body: registerSchema, tags: ['Auth'] },
    },
    async (request, reply) => {
      const { email, password, name } = request.body;

      try {
        const { user: authUser, token } = await matuSignUp(email, password, name);
        let user;
        try {
          user = await syncAppUser(authUser, { name });
        } catch (syncErr) {
          return reply.status(409).send({
            error: 'Error de sincronización',
            message:
              syncErr instanceof Error
                ? syncErr.message
                : 'No se pudo vincular el usuario con la aplicación',
          });
        }

        return reply.status(201).send({
          user: { id: user.id, email: user.email, name: user.name },
          token,
          message:
            'Cuenta creada. Revisa tu correo si MatuDB requiere verificación antes de iniciar sesión.',
        });
      } catch (err) {
        if (err instanceof MatuAuthError) {
          const status = err.statusCode === 409 ? 409 : err.statusCode >= 500 ? 502 : 400;
          return reply.status(status).send({
            error: 'Error de registro',
            message: err.message,
          });
        }
        throw err;
      }
    },
  );

  server.post(
    '/login',
    {
      schema: { body: loginSchema, tags: ['Auth'] },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      try {
        const { user: authUser, token } = await matuSignIn(email, password);
        const user = await syncAppUser(authUser);

        return {
          user: { id: user.id, email: user.email, name: user.name },
          token,
        };
      } catch (err) {
        if (err instanceof MatuAuthError) {
          return reply.status(401).send({
            error: 'No autorizado',
            message: err.message || 'Correo o contraseña incorrectos',
          });
        }
        throw err;
      }
    },
  );

  server.post(
    '/recover',
    {
      schema: {
        body: z.object({ email: z.string().email() }),
        tags: ['Auth'],
      },
    },
    async (request, reply) => {
      try {
        await matuRecoverPassword(request.body.email);
        return {
          success: true,
          message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña.',
        };
      } catch (err) {
        if (err instanceof MatuAuthError) {
          return reply.status(400).send({ error: 'Error', message: err.message });
        }
        throw err;
      }
    },
  );

  server.post(
    '/logout',
    { preHandler: [app.authenticate], schema: { tags: ['Auth'] } },
    async (_request, reply) => {
      return reply.send({
        success: true,
        message: 'Sesión cerrada correctamente',
      });
    },
  );

  server.get(
    '/me',
    { preHandler: [app.authenticate], schema: { tags: ['Auth'] } },
    async (request, reply) => {
      const user = await usersRepo.findUserById(request.userId!);
      if (!user) {
        return reply.status(404).send({
          error: 'No encontrado',
          message: 'Usuario no encontrado en la aplicación',
        });
      }
      return { id: user.id, email: user.email, name: user.name };
    },
  );
}
