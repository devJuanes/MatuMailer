export { MatuMailer } from './client.js';
export { MatuMailerError } from './errors.js';
export { detectSmtp, loadEnvToken } from './smtp-detect.js';
export type {
  BulkRecipient,
  BulkSendFromJsonPayload,
  BulkSendPayload,
  BulkSendResult,
  MatuMailerConfig,
  SendEmailPayload,
  SmtpPreset,
} from './types.js';
