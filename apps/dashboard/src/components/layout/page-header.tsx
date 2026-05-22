import { ProjectSelector } from './project-selector';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  children,
  showProject = true,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  showProject?: boolean;
}) {
  return (
    <div className={cn('mb-8 flex flex-col gap-4 pt-4 sm:flex-row sm:items-end sm:justify-between')}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-charcoal md:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {showProject && <ProjectSelector />}
        {children}
      </div>
    </div>
  );
}
