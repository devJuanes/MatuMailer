export type BlockType = 'heading' | 'text' | 'button' | 'divider' | 'spacer' | 'image';

export interface EmailBlock {
  id: string;
  type: BlockType;
  content?: string;
  href?: string;
  align?: 'left' | 'center' | 'right';
  fontSize?: number;
  color?: string;
  bgColor?: string;
  buttonColor?: string;
  padding?: number;
  height?: number;
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: 'Título',
  text: 'Texto',
  button: 'Botón',
  divider: 'Línea',
  spacer: 'Espacio',
  image: 'Imagen',
};

export function newBlock(type: BlockType): EmailBlock {
  const id = `blk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const defaults: Partial<Record<BlockType, Partial<EmailBlock>>> = {
    heading: { content: 'Tu título aquí', fontSize: 28, color: '#1c1917', align: 'center' },
    text: {
      content: 'Escribe tu mensaje. Usa {{nombre}} para variables dinámicas.',
      fontSize: 16,
      color: '#44403c',
      align: 'left',
    },
    button: {
      content: 'Ver más',
      href: 'https://ejemplo.com',
      buttonColor: '#c9a227',
      align: 'center',
    },
    spacer: { height: 24 },
    image: {
      content: 'https://via.placeholder.com/560x200',
      href: '',
      align: 'center',
    },
    divider: {},
  };
  return { id, type, ...defaults[type] } as EmailBlock;
}

export function extractVariables(text: string): string[] {
  const matches = text.matchAll(/\{\{\s*(\w+)\s*\}\}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

export function collectVariables(blocks: EmailBlock[], subject: string): string[] {
  const html = blocksToHtml(blocks);
  return extractVariables(html + subject);
}

function alignStyle(align?: string) {
  return align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
}

function renderBlock(b: EmailBlock): string {
  const pad = b.padding ?? 16;
  const align = alignStyle(b.align);
  switch (b.type) {
    case 'heading':
      return `<tr><td style="padding:${pad}px 40px;text-align:${align}"><h1 style="margin:0;font-size:${b.fontSize ?? 28}px;font-weight:700;color:${b.color ?? '#1c1917'};line-height:1.2">${b.content ?? ''}</h1></td></tr>`;
    case 'text':
      return `<tr><td style="padding:${pad}px 40px;text-align:${align}"><p style="margin:0;font-size:${b.fontSize ?? 16}px;line-height:1.6;color:${b.color ?? '#44403c'}">${(b.content ?? '').replace(/\n/g, '<br/>')}</p></td></tr>`;
    case 'button': {
      const bg = b.buttonColor ?? '#c9a227';
      return `<tr><td style="padding:${pad}px 40px;text-align:${align}"><a href="${b.href ?? '#'}" style="display:inline-block;padding:14px 32px;background:${bg};color:#1c1917;font-size:15px;font-weight:600;text-decoration:none;border-radius:999px">${b.content ?? 'Botón'}</a></td></tr>`;
    }
    case 'divider':
      return `<tr><td style="padding:${pad}px 40px"><hr style="border:none;border-top:1px solid #e7e5e4;margin:0"/></td></tr>`;
    case 'spacer':
      return `<tr><td style="height:${b.height ?? 24}px;line-height:${b.height ?? 24}px;font-size:1px">&nbsp;</td></tr>`;
    case 'image':
      return `<tr><td style="padding:${pad}px 40px;text-align:${align}"><img src="${b.content ?? ''}" alt="Imagen del correo" width="100%" style="max-width:520px;height:auto;border-radius:12px;display:inline-block" /></td></tr>`;
    default:
      return '';
  }
}

export function blocksToHtml(blocks: EmailBlock[]): string {
  const rows = blocks.map(renderBlock).join('');
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f0e6;font-family:'Segoe UI',system-ui,-apple-system,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f0e6">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(28,25,23,0.08)">
<tr><td style="height:6px;background:linear-gradient(90deg,#c9a227,#e8d48b)"></td></tr>
${rows}
<tr><td style="padding:24px 40px;text-align:center;font-size:12px;color:#a8a29e">Enviado con MatuMailer</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export const DEFAULT_BLOCKS: EmailBlock[] = [
  newBlock('heading'),
  newBlock('text'),
  newBlock('button'),
];
