import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildReplyHeaders, normalizeMessageId, replySubject } from './reply-headers.js';
import type { InboxEmail } from './types.js';

describe('reply-headers', () => {
  it('normalizes message ids', () => {
    assert.equal(normalizeMessageId('abc@x.com'), '<abc@x.com>');
    assert.equal(normalizeMessageId('<abc@x.com>'), '<abc@x.com>');
  });

  it('builds In-Reply-To and References', () => {
    const partial = {
      messageId: '<msg-1@test.com>',
      inReplyTo: '<parent@test.com>',
      references: ['<root@test.com>'],
    } as InboxEmail;
    const h = buildReplyHeaders(partial);
    assert.equal(h['In-Reply-To'], '<msg-1@test.com>');
    assert.match(h.References, /<root@test.com>/);
    assert.match(h.References, /<msg-1@test.com>/);
  });

  it('replySubject adds Re once', () => {
    assert.equal(replySubject('Hola'), 'Re: Hola');
    assert.equal(replySubject('Re: Hola'), 'Re: Hola');
  });
});
