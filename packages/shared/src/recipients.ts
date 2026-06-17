const EMAIL_FIELD_CANDIDATES = [
  'email',
  'correo',
  'mail',
  'e-mail',
  'emailAddress',
  'email_address',
];

const FIELD_ALIASES: Record<string, string[]> = {
  nombre: ['name', 'nombre', 'fullName', 'full_name', 'displayName', 'display_name'],
  correo: ['email', 'correo', 'mail'],
  telefono: ['phone', 'telefono', 'tel', 'mobile'],
  codigo: ['code', 'codigo', 'referralCode', 'referral_code'],
};

const SENSITIVE_FIELDS = new Set([
  'password',
  'passwd',
  'pass',
  'token',
  'secret',
  'apiKey',
  'api_key',
]);

export interface ParsedRecipient {
  email: string;
  data: Record<string, unknown>;
}

export interface ParseRecipientsOptions {
  emailField?: string;
  fieldMapping?: Record<string, string>;
  excludeFields?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeUsersInput(
  users: Record<string, Record<string, unknown>> | Array<Record<string, unknown>>,
): Record<string, unknown>[] {
  if (Array.isArray(users)) return users;
  return Object.values(users);
}

function detectEmailField(row: Record<string, unknown>, preferred?: string): string | null {
  if (preferred && typeof row[preferred] === 'string' && row[preferred].includes('@')) {
    return preferred;
  }
  for (const key of EMAIL_FIELD_CANDIDATES) {
    const value = row[key];
    if (typeof value === 'string' && value.includes('@')) return key;
  }
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      return key;
    }
  }
  return null;
}

function firstNameFromFullName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function applyAliases(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };
  for (const [canonical, sources] of Object.entries(FIELD_ALIASES)) {
    if (result[canonical] !== undefined && result[canonical] !== null) continue;
    for (const source of sources) {
      const value = result[source];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        result[canonical] = value;
        break;
      }
    }
  }
  if (typeof result.nombre === 'string') {
    result.primerNombre = firstNameFromFullName(result.nombre);
  } else if (typeof result.name === 'string') {
    result.primerNombre = firstNameFromFullName(result.name);
  }
  return result;
}

function buildRecipientData(
  row: Record<string, unknown>,
  emailField: string,
  options: ParseRecipientsOptions,
): Record<string, unknown> {
  const exclude = new Set([emailField, ...SENSITIVE_FIELDS, ...(options.excludeFields ?? [])]);

  const base: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (exclude.has(key)) continue;
    if (value === undefined || value === null) continue;
    base[key] = value;
  }

  if (options.fieldMapping) {
    for (const [templateVar, sourceField] of Object.entries(options.fieldMapping)) {
      const value = row[sourceField];
      if (value !== undefined && value !== null) {
        base[templateVar] = value;
      }
    }
  }

  return applyAliases(base);
}

export function parseRecipientsFromJson(
  users: Record<string, Record<string, unknown>> | Array<Record<string, unknown>>,
  options: ParseRecipientsOptions = {},
): { recipients: ParsedRecipient[]; emailField: string; skipped: number } {
  const rows = normalizeUsersInput(users);
  if (rows.length === 0) {
    return { recipients: [], emailField: options.emailField ?? 'email', skipped: 0 };
  }

  const sample = rows.find(isRecord);
  if (!sample) {
    return { recipients: [], emailField: options.emailField ?? 'email', skipped: rows.length };
  }

  const emailField = detectEmailField(sample, options.emailField);
  if (!emailField) {
    throw new Error('EMAIL_FIELD_NOT_FOUND');
  }

  const seen = new Set<string>();
  const recipients: ParsedRecipient[] = [];
  let skipped = 0;

  for (const row of rows) {
    if (!isRecord(row)) {
      skipped++;
      continue;
    }
    const rawEmail = row[emailField];
    if (typeof rawEmail !== 'string') {
      skipped++;
      continue;
    }
    const email = rawEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) {
      skipped++;
      continue;
    }
    seen.add(email);
    recipients.push({
      email,
      data: buildRecipientData(row, emailField, options),
    });
  }

  return { recipients, emailField, skipped };
}
