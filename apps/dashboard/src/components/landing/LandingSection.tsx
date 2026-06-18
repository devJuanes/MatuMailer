import { cn } from '@/lib/utils';

type LandingSectionProps = {
  id?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  centered?: boolean;
};

export function LandingSection({
  id,
  title,
  subtitle,
  children,
  className,
  centered = true,
}: LandingSectionProps) {
  return (
    <section id={id} className={cn('scroll-mt-28 py-16 sm:py-20', className)}>
      <div className={cn('mb-10 max-w-2xl', centered && 'mx-auto text-center')}>
        <h2 className="text-3xl font-bold tracking-tight text-charcoal sm:text-4xl">{title}</h2>
        {subtitle && (
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}
