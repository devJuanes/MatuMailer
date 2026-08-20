import { resolveCname, resolveMx, resolveTxt } from 'dns/promises';
import type { DnsRecordType } from '@matumailer/shared';

export interface DnsCheckResult {
  type: DnsRecordType;
  host: string;
  expected: string;
  found: boolean;
  actual: string | null;
  reason?: string;
}

async function lookupTxt(host: string): Promise<string[]> {
  try {
    const chunks = await resolveTxt(host);
    return chunks.map((parts) => parts.join(''));
  } catch {
    return [];
  }
}

async function lookupMx(host: string): Promise<Array<{ exchange: string; priority: number }>> {
  try {
    return await resolveMx(host);
  } catch {
    return [];
  }
}

async function lookupCname(host: string): Promise<string | null> {
  try {
    const targets = await resolveCname(host);
    return targets[0] ?? null;
  } catch {
    return null;
  }
}

function normalizeTxt(value: string): string {
  return value.replace(/;?\s+/g, ';').replace(/"/g, '').trim().toLowerCase();
}

function txtValuesContain(values: string[], expected: string): boolean {
  const target = normalizeTxt(expected);
  return values.some((v) => {
    const normalized = normalizeTxt(v);
    if (normalized === target) return true;
    if (target.startsWith(normalized)) return true;
    return normalized.includes(target.split(';')[0] ?? '');
  });
}

function txtStartsWithAny(values: string[], prefix: string): string | null {
  for (const v of values) {
    const normalized = normalizeTxt(v);
    if (normalized.startsWith(normalizeTxt(prefix))) return v;
  }
  return null;
}

export interface DnsCheckItem {
  type: DnsRecordType;
  host: string;
  expected: string;
  matchMode?: 'exact' | 'contains' | 'startsWith' | 'mx';
}

export async function checkDnsRecords(
  items: DnsCheckItem[],
  _timeoutMs = 4000,
): Promise<DnsCheckResult[]> {
  const checks = items.map(async (item): Promise<DnsCheckResult> => {
    if (item.type === 'TXT') {
      const records = await lookupTxt(item.host);
      const expected = item.expected;
      const mode = item.matchMode ?? 'exact';
      const found =
        mode === 'startsWith'
          ? !!txtStartsWithAny(records, expected)
          : mode === 'contains'
            ? records.some((r) => normalizeTxt(r).includes(normalizeTxt(expected)))
            : txtValuesContain(records, expected);
      return {
        type: 'TXT',
        host: item.host,
        expected,
        found,
        actual: records[0] ?? null,
      };
    }
    if (item.type === 'MX') {
      const records = await lookupMx(item.host);
      const expected = item.expected.replace(/\.$/, '').toLowerCase();
      const found = records.some((r) => r.exchange.replace(/\.$/, '').toLowerCase() === expected);
      return {
        type: 'MX',
        host: item.host,
        expected: item.expected,
        found,
        actual: records[0]?.exchange ?? null,
      };
    }
    if (item.type === 'CNAME') {
      const target = await lookupCname(item.host);
      const found = !!target && target.toLowerCase() === item.expected.toLowerCase();
      return {
        type: 'CNAME',
        host: item.host,
        expected: item.expected,
        found,
        actual: target,
      };
    }
    return {
      type: item.type,
      host: item.host,
      expected: item.expected,
      found: false,
      actual: null,
      reason: 'Tipo no soportado',
    };
  });

  try {
    return await Promise.all(checks);
  } catch {
    return await Promise.all(
      checks.map(async (p) => {
        try {
          return await p;
        } catch {
          return {
            type: 'TXT' as DnsRecordType,
            host: '',
            expected: '',
            found: false,
            actual: null,
            reason: 'DNS lookup falló',
          };
        }
      }),
    );
  }
}

/** Verifica DNS específico para un dominio: SPF, DKIM, DMARC, MX, CNAME. */
export async function checkDomainDns(opts: {
  domain: string;
  dkimSelector: string;
  dkimPublicKey: string;
  expectedSpfContains?: string;
  returnPathHost?: string;
  returnPathTarget?: string;
  mxHost?: string;
  mxTarget?: string;
}): Promise<DnsCheckResult[]> {
  const items: DnsCheckItem[] = [
    {
      type: 'TXT',
      host: opts.domain,
      expected:
        opts.expectedSpfContains ?? `ip4:${process.env.MATUMAILER_RELAY_IP || '13.140.160.248'}`,
      matchMode: 'contains',
    },
    {
      type: 'TXT',
      host: `${opts.dkimSelector}._domainkey.${opts.domain}`,
      expected: `v=DKIM1; k=rsa; p=${opts.dkimPublicKey}`,
      matchMode: 'contains',
    },
    {
      type: 'TXT',
      host: `_dmarc.${opts.domain}`,
      expected: 'v=DMARC1',
      matchMode: 'startsWith',
    },
  ];

  if (opts.mxHost && opts.mxTarget) {
    items.push({ type: 'MX', host: opts.mxHost, expected: opts.mxTarget, matchMode: 'mx' });
  }

  if (opts.returnPathHost && opts.returnPathTarget) {
    items.push({
      type: 'CNAME',
      host: opts.returnPathHost,
      expected: opts.returnPathTarget,
      matchMode: 'exact',
    });
  }

  return checkDnsRecords(items);
}
