import {
  BarChart3,
  CalendarClock,
  Code2,
  Globe,
  Mail,
  Send,
  Server,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';

export const LANDING_FEATURES = [
  {
    icon: Server,
    title: 'SMTP automático',
    desc: 'Conecta Gmail, Outlook, Zoho u otro proveedor. MatuMailer detecta la configuración y cifra tus credenciales.',
  },
  {
    icon: Mail,
    title: 'Plantillas dinámicas',
    desc: 'Crea correos con variables {{nombre}}, {{enlace}} y un editor visual. Reutiliza plantillas en todos tus proyectos.',
  },
  {
    icon: Code2,
    title: 'SDK + API REST',
    desc: 'Integra en minutos con npm install matumailer. También disponible vía HTTP para cualquier stack.',
  },
  {
    icon: Send,
    title: 'Envío masivo',
    desc: 'Lanza campañas a listas de destinatarios con control de entrega. Disponible en plan Premium.',
    premium: true,
  },
  {
    icon: CalendarClock,
    title: 'Correos programados',
    desc: 'Agenda envíos para el momento exacto: recordatorios, onboarding diferido o newsletters.',
    premium: true,
  },
  {
    icon: BarChart3,
    title: 'Analíticas de entrega',
    desc: 'Consulta cuántos correos se enviaron, entregaron o fallaron. Logs detallados por proyecto.',
  },
] as const;

export const LANDING_STEPS = [
  {
    n: '01',
    title: 'Crea tu cuenta gratis',
    desc: 'Regístrate con MatuDB Auth en menos de un minuto. Sin tarjeta de crédito.',
  },
  {
    n: '02',
    title: 'Configura SMTP y plantillas',
    desc: 'Añade tu proveedor de correo, diseña plantillas y prueba el envío desde el dashboard.',
  },
  {
    n: '03',
    title: 'Integra con tu código',
    desc: 'Copia tu token API, instala el SDK y envía correos transaccionales desde tu app.',
  },
] as const;

export const USE_CASES = [
  {
    icon: Sparkles,
    title: 'Bienvenida y onboarding',
    desc: 'Correos automáticos cuando un usuario se registra en tu SaaS o e-commerce.',
  },
  {
    icon: Shield,
    title: 'Verificación y seguridad',
    desc: 'Códigos OTP, restablecer contraseña y alertas de acceso con plantillas confiables.',
  },
  {
    icon: Users,
    title: 'Notificaciones de producto',
    desc: 'Avisos de pedidos, facturas, cambios de estado y actualizaciones para tu equipo.',
  },
  {
    icon: Globe,
    title: 'Startups y equipos LATAM',
    desc: 'Infraestructura en español, soporte cercano y precios en pesos colombianos.',
  },
] as const;

export const TRUST_SIGNALS = [
  { label: 'Plan gratis', detail: 'Empieza sin tarjeta' },
  { label: 'Hecho en Colombia', detail: 'Soporte en español' },
  { label: 'Credenciales cifradas', detail: 'SMTP seguro' },
  { label: 'SDK oficial npm', detail: 'Integración rápida' },
] as const;

export const FAQ_ITEMS = [
  {
    q: '¿Qué es MatuMailer y para quién es?',
    a: 'MatuMailer es infraestructura de correo pensada para desarrolladores, startups y equipos técnicos que necesitan enviar correos transaccionales sin montar su propio servidor SMTP.',
  },
  {
    q: '¿Tiene plan gratuito?',
    a: 'Sí. Incluye 1 proyecto, configuración SMTP, plantillas personalizadas y correos de prueba. Ideal para desarrollar e integrar antes de escalar.',
  },
  {
    q: '¿Qué incluye MatuMailer Premium?',
    a: 'Proyectos ilimitados, envío masivo, correos programados, plantillas sin límite y cuota ampliada. Desde $25.000 COP/mes.',
  },
  {
    q: '¿Qué proveedores SMTP puedo usar?',
    a: 'Gmail, Outlook, Zoho y cualquier servidor SMTP estándar. MatuMailer detecta el proveedor y te guía en la configuración.',
  },
  {
    q: '¿Cómo integro MatuMailer en mi proyecto?',
    a: 'Instala el paquete npm matumailer, obtén tu token en el dashboard y usa el SDK o la API REST para enviar correos con plantillas.',
  },
  {
    q: '¿Ofrecen soporte?',
    a: 'Sí. Escríbenos por email o WhatsApp. Atendemos de lunes a viernes en horario Colombia (COT).',
  },
] as const;

export const HERO_STATS = [
  { value: '3 pasos', label: 'para tu primer envío' },
  { value: 'npm', label: 'SDK oficial' },
  { value: '100%', label: 'en español' },
] as const;
