/**
 * RUTA DESHABILITIC.
 *
 * MatuMailer ya no usa SMTP propio del proyecto. Todo el correo saliente va
 * por el Postfix local del server firmado con el DKIM del dominio verificado
 * correspondiente. Ver `routes/aliases.routes.ts` y `routes/domains.routes.ts`
 * para la nueva API de envío.
 *
 * Este archivo se mantiene por compatibilidad de imports antiguos. No
 * debe montarse en `index.ts`.
 */

// export const smtpRoutes = ... (deshabilitado)
