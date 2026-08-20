import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(500).optional(),
});

export const createTokenSchema = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export const smtpConfigSchema = z.object({
  provider: z.enum(['gmail', 'outlook', 'zoho', 'custom']),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean().default(false),
  username: z.string().min(1),
  password: z.string().min(1),
  fromEmail: z.string().email(),
  fromName: z.string().max(100).optional(),
});

export const smtpDetectSchema = z.object({
  email: z.string().email(),
});

const templateBlockSchema = z.object({
  id: z.string(),
  type: z.enum(['heading', 'text', 'button', 'divider', 'spacer', 'image']),
  content: z.string().optional(),
  href: z.string().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  fontSize: z.number().optional(),
  color: z.string().optional(),
  bgColor: z.string().optional(),
  buttonColor: z.string().optional(),
  padding: z.number().optional(),
  height: z.number().optional(),
});

export const templateCreateSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  htmlContent: z.string().min(1),
  builderData: z.array(templateBlockSchema).optional().nullable(),
  variables: z.array(z.string()).default([]),
});

export const templateUpdateSchema = templateCreateSchema.partial();

export const sendEmailSchema = z
  .object({
    to: z.union([z.string().email(), z.array(z.string().email())]),
    subject: z.string().min(1).max(200).optional(),
    template: z.string().optional(),
    html: z.string().optional(),
    text: z.string().optional(),
    data: z.record(z.unknown()).optional(),
    scheduledAt: z.string().datetime().optional(),
    from: z.string().email().optional(),
    fromName: z.string().max(120).optional(),
    /**
     * Cuando el proyecto tiene varios dominios verificados, se puede forzar
     * desde cuál enviar resolviendo el alias por `domainId`. Si no se pasa,
     * el server usa el `default_domain_id` del proyecto.
     */
    domainId: z.string().uuid().optional(),
    /**
     * Opcional. Se infiere del token `mm_live_...`. Si el caller usa un JWT
     * de MatuDB (sin projectId), debe pasarlo en el body.
     */
    projectId: z.string().uuid().optional(),
    replyTo: z.union([z.string().email(), z.array(z.string().email())]).optional(),
    cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
    bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
    headers: z.record(z.string()).optional(),
    tags: z
      .array(z.object({ name: z.string().min(1).max(40), value: z.string().max(200) }))
      .optional(),
  })
  .refine((d) => !!(d.template || d.html || d.subject), {
    message: 'Indica subject, template o html',
  });

export const scheduleEmailSchema = z
  .object({
    to: z.union([z.string().email(), z.array(z.string().email())]),
    scheduledAt: z.string().datetime(),
    subject: z.string().min(1).max(200).optional(),
    template: z.string().optional(),
    html: z.string().optional(),
    text: z.string().optional(),
    data: z.record(z.unknown()).optional(),
  })
  .refine((d) => !!(d.template || (d.html && d.html.length > 0)), {
    message: 'Indica una plantilla o contenido HTML',
  });

export const analyzeEmailSchema = z.object({
  subject: z.string().max(200).optional(),
  html: z.string().optional(),
  template: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});

export const sendTestEmailSchema = z
  .object({
    to: z.string().email(),
    subject: z.string().min(1).max(200).optional(),
    template: z.string().optional(),
    html: z.string().optional(),
    text: z.string().optional(),
    data: z.record(z.unknown()).optional(),
  })
  .refine((d) => !!(d.template || (d.html && d.html.length > 0)), {
    message: 'Indica una plantilla o contenido HTML',
  });

const bulkRecipientSchema = z.object({
  email: z.string().email(),
  data: z.record(z.unknown()).optional(),
});

export const bulkSendEmailSchema = z.object({
  template: z.string().min(1),
  subject: z.string().min(1).max(200).optional(),
  recipients: z.array(bulkRecipientSchema).min(1).max(500),
  delayMs: z.number().int().min(0).max(5000).optional(),
  scheduledAt: z.string().datetime().optional(),
  campaignName: z.string().max(150).optional(),
});

export const bulkSendFromJsonSchema = z.object({
  template: z.string().min(1),
  subject: z.string().min(1).max(200).optional(),
  emailField: z.string().min(1).optional(),
  fieldMapping: z.record(z.string()).optional(),
  excludeFields: z.array(z.string()).optional(),
  delayMs: z.number().int().min(0).max(5000).optional(),
  users: z.union([z.array(z.record(z.unknown())), z.record(z.record(z.unknown()))]),
});

const DOMAIN_REGEX = /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}(?<![-]))(\.[a-z0-9-]{1,63})+$/;

export const createDomainSchema = z.object({
  domain: z
    .string()
    .min(3)
    .max(253)
    .regex(DOMAIN_REGEX, 'Dominio inválido (ej. destin.com o mail.destin.com)'),
  region: z.enum(['us-east-1', 'sa-east-1', 'eu-west-1']).default('us-east-1'),
});

export const updateDomainSchema = z.object({
  region: z.enum(['us-east-1', 'sa-east-1', 'eu-west-1']).optional(),
});

// ─── Aliases ─────────────────────────────────────────────────────────────────
// `local_part` es la parte antes del `@` del alias. La validación `^[a-z0-9._+-]+$`
// es la convención más permisiva de RFC 5321 que todos los servidores MX aceptan.
const localPartRegex = /^[a-z0-9._+-]+$/;

export const createAliasSchema = z.object({
  domainId: z.string().uuid(),
  localPart: z
    .string()
    .min(1)
    .max(64)
    .regex(localPartRegex, 'Solo letras minúsculas, números, . _ + -'),
  displayName: z.string().max(120).optional().nullable(),
  replyTo: z.string().email().optional().nullable(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export const updateAliasSchema = z.object({
  displayName: z.string().max(120).optional().nullable(),
  replyTo: z.string().email().optional().nullable(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const listAliasesQuerySchema = z.object({
  projectId: z.string().uuid(),
  domainId: z.string().uuid().optional(),
  activeOnly: z.coerce.boolean().default(false),
});

export const sendFromDomainSchema = z
  .object({
    to: z.union([z.string().email(), z.array(z.string().email())]),
    from: z.string().email().optional(),
    fromName: z.string().max(120).optional(),
    subject: z.string().min(1).max(200).optional(),
    template: z.string().optional(),
    html: z.string().optional(),
    text: z.string().optional(),
    data: z.record(z.unknown()).optional(),
    replyTo: z.union([z.string().email(), z.array(z.string().email())]).optional(),
    cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
    bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
    headers: z.record(z.string()).optional(),
    scheduledAt: z.string().datetime().optional(),
    tags: z
      .array(z.object({ name: z.string().min(1).max(40), value: z.string().max(200) }))
      .optional(),
  })
  .refine((d) => !!(d.template || d.html || d.subject), {
    message: 'Indica subject, template o html',
  });
