import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHeader } from '@/components/landing/LandingHeader';

type PublicPageLayoutProps = {
  children: React.ReactNode;
  centered?: boolean;
};

export function PublicPageLayout({ children, centered = false }: PublicPageLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-cream">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gold/15 via-transparent to-amber-50/30" />
      <LandingHeader />
      <main
        className={
          centered
            ? 'relative z-10 flex flex-1 items-center justify-center p-6'
            : 'relative z-10 flex-1'
        }
      >
        {children}
      </main>
      <LandingFooter />
    </div>
  );
}
