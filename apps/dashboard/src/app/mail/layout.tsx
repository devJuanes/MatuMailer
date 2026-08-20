import type { Metadata } from 'next';
import './mail.css';

export const metadata: Metadata = {
  title: 'Matu Mail',
  description: 'Bandeja de entrada MatuMailer',
};

export default function MailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mail-shell">
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      {children}
    </div>
  );
}
