export { MatuMailer } from './client.js';
export { MatuMailerError } from './errors.js';
export { detectSmtp, loadEnvToken } from './smtp-detect.js';
export type {
  Alias,
  BulkRecipient,
  BulkSendFromJsonPayload,
  BulkSendPayload,
  BulkSendResult,
  CreateAliasPayload,
  CreateDomainPayload,
  DomainDnsRecord,
  DomainRecord,
  DomainVerifyResult,
  DomainWithRecords,
  GroupSendPayload,
  GroupSendResult,
  MatuMailerConfig,
  SendEmailPayload,
  SmtpPreset,
  UpdateAliasPayload,
} from './types.js';
