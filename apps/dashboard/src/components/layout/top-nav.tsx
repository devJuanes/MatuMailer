'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Bell,
  BookOpen,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Mail,
  Server,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { clearToken } from '@/lib/api';

const nav = [
  { href: '/dashboard', label: 'Resumen' },
  { href: '/dashboard/projects', label: 'Proyectos' },
  { href: '/dashboard/smtp', label: 'SMTP' },
  { href: '/dashboard/templates', label: 'Plantillas' },
  { href: '/dashboard/creador', label: 'Creador' },
  { href: '/dashboard/correo-prueba', label: 'Prueba' },
  { href: '/dashboard/programados', label: 'Programados' },
  { href: '/dashboard/logs', label: 'Correos' },
  { href: '/dashboard/analytics', label: 'Analíticas' },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearToken();
    router.push('/login');
  }

  return (
    <header className="sticky top-0 z-50 px-6 py-4">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2 rounded-full border border-white/70 bg-white/60 px-4 py-2 shadow-soft backdrop-blur-md"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold font-bold text-charcoal text-sm">
            M
          </div>
          <span className="font-semibold tracking-tight text-charcoal">MatuMailer</span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-white/70 bg-white/50 p-1.5 shadow-soft backdrop-blur-md lg:flex">
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn('pill-nav', active ? 'pill-nav-active' : 'pill-nav-inactive')}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/documentacion"
            className="hidden rounded-full p-2.5 text-muted-foreground transition-colors hover:bg-white/70 sm:flex"
            title="Documentación"
          >
            <BookOpen className="h-5 w-5" />
          </Link>
          <button
            type="button"
            className="rounded-full p-2.5 text-muted-foreground transition-colors hover:bg-white/70"
            aria-label="Notificaciones"
          >
            <Bell className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-full p-2.5 text-muted-foreground transition-colors hover:bg-white/70"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut className="h-5 w-5" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-charcoal text-sm font-semibold text-gold">
            U
          </div>
        </div>
      </div>

      <nav className="mx-auto mt-3 flex max-w-[1400px] gap-1 overflow-x-auto rounded-2xl border border-white/60 bg-white/40 p-1 backdrop-blur-sm lg:hidden">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium',
                active ? 'bg-charcoal text-white' : 'text-muted-foreground',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

export const navIcons = {
  dashboard: LayoutDashboard,
  projects: FolderKanban,
  smtp: Server,
  templates: FileText,
  logs: Mail,
  analytics: BarChart3,
  docs: BookOpen,
  settings: Settings,
};
