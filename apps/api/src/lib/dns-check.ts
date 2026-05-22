import { resolveTxt } from 'dns/promises';

export interface DnsAuthReport {
  domain: string;
  spf: { found: boolean; record?: string };
  dmarc: { found: boolean; record?: string };
  ok: boolean;
  summary: string;
}

async function lookupTxt(host: string): Promise<string[]> {
  try {
    const chunks = await resolveTxt(host);
    return chunks.map((parts) => parts.join(''));
  } catch {
    return [];
  }
}

export async function checkDomainAuth(domain: string): Promise<DnsAuthReport> {
  const d = domain.toLowerCase().trim();
  const rootTxt = await lookupTxt(d);
  const spfRecord = rootTxt.find((r) => r.startsWith('v=spf1'));

  const dmarcTxt = await lookupTxt(`_dmarc.${d}`);
  const dmarcRecord = dmarcTxt.find((r) => r.startsWith('v=DMARC1'));

  const spfFound = !!spfRecord;
  const dmarcFound = !!dmarcRecord;
  const ok = spfFound;

  let summary: string;
  if (spfFound && dmarcFound) {
    summary = 'SPF y DMARC detectados: excelente para bandeja principal.';
  } else if (spfFound) {
    summary = 'SPF encontrado. Añade DMARC en _dmarc para reforzar confianza.';
  } else {
    summary =
      'No se encontró registro SPF público. Configúralo en tu DNS (Zoho/Google/hosting).';
  }

  return {
    domain: d,
    spf: { found: spfFound, record: spfRecord },
    dmarc: { found: dmarcFound, record: dmarcRecord },
    ok,
    summary,
  };
}
