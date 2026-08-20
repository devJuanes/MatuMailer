import {
  ArrowLeftRight,
  AtSign,
  BarChart3,
  BookOpen,
  CalendarClock,
  Crown,
  FileText,
  FolderKanban,
  Globe,
  Inbox,
  LayoutDashboard,
  Mail,
  Palette,
  PenLine,
  Send,
  TerminalSquare,
  Users,
  UsersRound,
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
  { href: '/mail', label: 'Bandeja', icon: Inbox },
  { href: '/hub', label: 'Cambiar modo', icon: ArrowLeftRight },
  { href: '/dashboard/projects', label: 'Proyectos', icon: FolderKanban },
  { href: '/dashboard/domains', label: 'Dominios', icon: Globe },
  { href: '/dashboard/aliases', label: 'Aliases', icon: AtSign },
  { href: '/dashboard/send', label: 'Enviar', icon: TerminalSquare },
  { href: '/dashboard/branding', label: 'Marca', icon: Palette },
  { href: '/dashboard/templates', label: 'Plantillas', icon: FileText },
  { href: '/dashboard/creador', label: 'Creador', icon: PenLine },
  { href: '/dashboard/contactos', label: 'Contactos', icon: Users },
  { href: '/dashboard/grupos', label: 'Grupos', icon: UsersRound, premiumOnly: true },
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
