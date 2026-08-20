export function loadEnvToken(): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return (
      process.env.MATUMAILER_TOKEN ??
      process.env.MATU_MAILER_TOKEN ??
      process.env.MATUMAILER_API_KEY
    );
  }
  return undefined;
}
