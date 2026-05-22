'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ projects: Project[] }>('/api/projects')
      .then((res) => {
        setProjects(res.projects);
        const saved = localStorage.getItem('matumailer_project_id');
        const id = saved && res.projects.find((p) => p.id === saved)?.id;
        setActiveId(id ?? res.projects[0]?.id ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function selectProject(id: string) {
    setActiveId(id);
    localStorage.setItem('matumailer_project_id', id);
  }

  const active = projects.find((p) => p.id === activeId) ?? null;

  return { projects, active, activeId, selectProject, loading, refresh: async () => {
    const res = await api<{ projects: Project[] }>('/api/projects');
    setProjects(res.projects);
  }};
}
