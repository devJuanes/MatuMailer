import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  joinTxtRecords,
  normalizeDnsHostname,
  normalizeDnsTxt,
} from './dns-normalize.js';

describe('dns-normalize', () => {
  it('normalizes hostnames', () => {
    assert.equal(normalizeDnsHostname('MATUMAILER.MATUBYTE.COM.'), 'matumailer.matubyte.com');
  });

  it('normalizes TXT with whitespace', () => {
    const a = 'v=DKIM1; k=rsa; p=ABC DEF';
    const b = '"v=DKIM1; k=rsa; p=ABC\nDEF"';
    assert.equal(normalizeDnsTxt(a), normalizeDnsTxt(b));
  });

  it('joins fragmented TXT RRs', () => {
    assert.equal(joinTxtRecords(['v=DKIM1; k=rsa; p=PART1', 'PART2']), 'v=dkim1;k=rsa;p=part1part2');
  });
});
