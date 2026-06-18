'use client';

import { useProjects } from '@/hooks/use-project';
import { PreloadInline } from '@/lib/preload';
import { cn } from '@/lib/utils';

export function ProjectSelector() {
  const { projects, activeId, selectProject, loading } = useProjects();

  if (loading) {
    return (
      <span className="inline-flex h-11 items-center rounded-full bg-white/60 px-4">
        <PreloadInline />
      </span>
    );
  }

  return (
    <select
      value={activeId ?? ''}
      onChange={(e) => selectProject(e.target.value)}
      aria-label="Seleccionar proyecto"
      className={cn(
        'h-11 min-w-[160px] rounded-full border border-white/80 bg-white/70 px-4 text-sm font-medium text-charcoal shadow-soft backdrop-blur-md',
        'focus:outline-none focus:ring-2 focus:ring-gold/40',
      )}
    >
      {projects.length === 0 && <option value="">Sin proyectos</option>}
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
