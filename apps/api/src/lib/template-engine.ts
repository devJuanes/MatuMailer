export function renderTemplate(
  html: string,
  subject: string,
  data: Record<string, unknown> = {},
): { html: string; subject: string } {
  const replace = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const value = data[key];
      return value !== undefined && value !== null ? String(value) : '';
    });

  return {
    html: replace(html),
    subject: replace(subject),
  };
}

export function extractVariables(content: string): string[] {
  const matches = content.matchAll(/\{\{(\w+)\}\}/g);
  const vars = new Set<string>();
  for (const m of matches) vars.add(m[1]);
  return Array.from(vars);
}
