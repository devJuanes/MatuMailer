import {
  BarChart3,
  BookOpen,
  CalendarClock,
  Crown,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Mail,
  PenLine,
  Send,
  Server,
  type LucideIcon,
} from 'lucide-react';

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  premiumOnly?: boolean;
};

export const dashboardNav: DashboardNavItem[] = [
  { href: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { href: '/dashboard/projects', label: 'Proyectos', icon: FolderKanban },
  { href: '/dashboard/smtp', label: 'SMTP', icon: Server },
  { href: '/dashboard/templates', label: 'Plantillas', icon: FileText },
  { href: '/dashboard/creador', label: 'Creador', icon: PenLine },
  { href: '/dashboard/correo-prueba', label: 'Prueba', icon: Mail },
  { href: '/dashboard/envio-masivo', label: 'Envío masivo', icon: Send, premiumOnly: true },
  { href: '/dashboard/programados', label: 'Programados', icon: CalendarClock, premiumOnly: true },
  { href: '/dashboard/logs', label: 'Correos', icon: Mail },
  { href: '/dashboard/analytics', label: 'Analíticas', icon: BarChart3 },
  { href: '/dashboard/premium', label: 'Premium', icon: Crown },
  { href: '/dashboard/documentacion', label: 'Documentación', icon: BookOpen },
];

export function isNavActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}
