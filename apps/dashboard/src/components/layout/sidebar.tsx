'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, Lock } from 'lucide-react';
import { AppLogo } from '@/components/brand/AppLogo';
import { cn } from '@/lib/utils';
import { dashboardNav, isNavActive } from './nav-config';
import { usePlan } from '@/providers/plan-provider';

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { isPremium } = usePlan();

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-charcoal/20 backdrop-blur-sm lg:hidden"
          aria-label="Cerrar menú"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-white/70 bg-white/80 shadow-soft backdrop-blur-md transition-transform duration-300 lg:sticky lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-5">
          <Link href="/dashboard" className="flex min-w-0 items-center" onClick={onClose}>
            <AppLogo size="sm" />
          </Link>
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/70 lg:hidden"
            aria-label="Cerrar menú"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <ul className="space-y-0.5">
            {dashboardNav.map((item) => {
              const active = isNavActive(pathname, item.href);
              const Icon = item.icon;
              const locked = item.premiumOnly && !isPremium;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-charcoal text-white shadow-sm'
                        : locked
                          ? 'text-muted-foreground/80 hover:bg-white/70 hover:text-charcoal'
                          : 'text-muted-foreground hover:bg-white/70 hover:text-charcoal',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-[18px] w-[18px] shrink-0',
                        active ? 'text-gold' : 'text-muted-foreground',
                      )}
                    />
                    <span className="truncate flex-1">{item.label}</span>
                    {locked && <Lock className="h-3.5 w-3.5 shrink-0 opacity-60" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
