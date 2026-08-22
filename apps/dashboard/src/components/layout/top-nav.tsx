'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, BookOpen, Crown, Download, Loader2, LogOut, Menu } from 'lucide-react';
import { AppLogo } from '@/components/brand/AppLogo';
import { API_URL, clearToken, getToken } from '@/lib/api';
import { signOut } from '@/lib/auth-matudb';
import { usePlan } from '@/providers/plan-provider';
import { Button } from '@/components/ui/button';

type TopNavProps = {
  onMenuClick: () => void;
};

export function TopNav({ onMenuClick }: TopNavProps) {
  const router = useRouter();
  const { isPremium, loading } = usePlan();
  const [downloading, setDownloading] = useState(false);

  function logout() {
    void signOut().finally(() => {
      clearToken();
      router.push('/login');
    });
  }

  async function downloadWindowsApp() {
    if (downloading) return;
    setDownloading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/desktop/download/windows/latest`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? `Error ${res.status}`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="?([^";]+)"?/i.exec(disposition);
      const fileName = match?.[1] ?? 'MatuMail-Windows.zip';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo descargar el cliente Windows.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-cream/80 px-4 py-3 backdrop-blur-md sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            className="rounded-full p-2.5 text-muted-foreground transition-colors hover:bg-white/70 lg:hidden"
            aria-label="Abrir menú"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="lg:hidden">
            <AppLogo size="xs" />
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={downloading}
            onClick={() => void downloadWindowsApp()}
            title="Descargar Matu Mail para Windows"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{downloading ? 'Descargando…' : 'Descargar'}</span>
          </Button>
          {!loading && !isPremium && (
            <Link href="/dashboard/premium">
              <Button size="sm" className="hidden gap-1.5 sm:inline-flex">
                <Crown className="h-4 w-4" />
                Premium
              </Button>
            </Link>
          )}
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
    </header>
  );
}
