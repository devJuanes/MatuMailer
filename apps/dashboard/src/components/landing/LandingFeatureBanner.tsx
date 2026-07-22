import Link from 'next/link';
import { ArrowRight, Crown, Mail, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type BannerTone = 'gold' | 'dark' | 'cream';

type LandingFeatureBannerProps = {
  tone?: BannerTone;
  eyebrow?: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  icon?: 'mail' | 'crown' | 'groups';
  className?: string;
};

const icons = {
  mail: Mail,
  crown: Crown,
  groups: UsersRound,
};

export function LandingFeatureBanner({
  tone = 'gold',
  eyebrow,
  title,
  description,
  href,
  cta,
  icon = 'mail',
  className,
}: LandingFeatureBannerProps) {
  const Icon = icons[icon];
  return (
    <aside
      className={cn(
        'relative overflow-hidden rounded-[1.75rem] px-6 py-8 sm:px-10 sm:py-10',
        tone === 'gold' && 'bg-gradient-to-br from-gold via-amber-300 to-amber-400 text-charcoal',
        tone === 'dark' && 'bg-charcoal text-white',
        tone === 'cream' && 'border border-charcoal/10 bg-white/70 text-charcoal shadow-soft',
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full blur-2xl',
          tone === 'dark' ? 'bg-gold/25' : 'bg-white/40',
        )}
      />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <div className="mb-3 flex items-center gap-2">
            <span
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-2xl',
                tone === 'dark' ? 'bg-gold/20 text-gold' : 'bg-charcoal/10 text-charcoal',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            {eyebrow && (
              <span
                className={cn(
                  'text-xs font-bold uppercase tracking-[0.14em]',
                  tone === 'dark' ? 'text-gold' : 'text-charcoal/70',
                )}
              >
                {eyebrow}
              </span>
            )}
          </div>
          <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h3>
          <p
            className={cn(
              'mt-3 text-base leading-relaxed',
              tone === 'dark' ? 'text-white/70' : 'text-charcoal/75',
            )}
          >
            {description}
          </p>
        </div>
        <Button
          size="lg"
          variant={tone === 'dark' ? 'gold' : 'default'}
          className={cn(tone === 'gold' && 'bg-charcoal text-gold hover:bg-charcoal/90')}
          asChild
        >
          <Link href={href}>
            {cta} <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </aside>
  );
}
