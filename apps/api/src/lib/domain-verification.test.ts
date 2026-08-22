import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { DomainDnsRecord } from '@matumailer/shared';
import type { DnsCheckResult } from './domain-dns.js';
import { domainStatusFromSummary, summarizeVerification } from './domain-verification.js';

function mockCheck(partial: Partial<DnsCheckResult> & Pick<DnsCheckResult, 'purpose' | 'found'>): DnsCheckResult {
  return {
    type: 'TXT',
    host: 'example.com',
    expected: '',
    status: partial.found ? 'verified' : 'failed',
    actual: null,
    detected: [],
    ...partial,
  };
}

describe('summarizeVerification', () => {
  it('marks sending ready when SPF and DKIM pass', () => {
    const checks = [
      mockCheck({ purpose: 'spf', found: true, host: 'example.com' }),
      mockCheck({ purpose: 'dkim', found: true, host: 'mm._domainkey.example.com' }),
      mockCheck({ purpose: 'dmarc', found: true, host: '_dmarc.example.com', status: 'verified' }),
      mockCheck({ purpose: 'mx', found: false, type: 'MX', host: 'example.com', status: 'missing' }),
      mockCheck({ purpose: 'return_path', found: false, type: 'CNAME', host: 'rp.example.com', status: 'failed' }),
    ];
    const s = summarizeVerification(checks, [] as DomainDnsRecord[]);
    assert.equal(s.sendingReady, true);
    assert.equal(domainStatusFromSummary(s), 'verified');
  });

  it('warns on multiple MX providers', () => {
    const checks = [
      mockCheck({ purpose: 'spf', found: true }),
      mockCheck({ purpose: 'dkim', found: true }),
      mockCheck({
        purpose: 'mx',
        found: true,
        type: 'MX',
        status: 'warning',
        reason: 'También hay mx.zoho.com',
        detected: ['10 matumailer.matubyte.com', '10 mx.zoho.com'],
      }),
    ];
    const s = summarizeVerification(checks, []);
    assert.ok(s.warnings.some((w) => w.toLowerCase().includes('zoho')));
  });
});
