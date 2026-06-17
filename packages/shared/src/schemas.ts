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
