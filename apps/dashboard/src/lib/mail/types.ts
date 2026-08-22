/** Types for Matu Mail inbox (ported from mail SPA). */

export type MailCategory = 'primary' | 'promotions' | 'socials' | 'updates';
export type MailFolder = 'inbox' | 'favorite' | 'sent' | 'archive' | 'trash' | 'spam';
/** Alias email or 'all' */
export type AccountId = string;

export interface MailAccount {
  id: string;
  email: string;
  label: string;
  color: string;
}

export interface InboxEmail {
  id: string;
  from: {
    name: string;
    email: string;
    avatar: string;
    verified?: boolean;
    online?: boolean;
  };
  to: string;
  subject: string;
  preview: string;
  body: string;
  summary: string;
  date: string;
  dateLabel: string;
  timestamp: number;
  unread: number;
  starred: boolean;
  pinned: boolean;
  hasAttachment: boolean;
  category: MailCategory;
  folder: MailFolder;
  account: AccountId;
  section: 'pinned' | 'today' | 'yesterday' | 'earlier';
  quickReplies: string[];
  /** Message-ID RFC del correo recibido (para hilos). */
  messageId?: string | null;
  inReplyTo?: string | null;
  references?: string[];
}
