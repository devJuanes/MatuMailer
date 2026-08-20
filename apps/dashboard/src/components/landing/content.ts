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
    title: 'Dominios verificados',
    desc: 'Añade tu dominio, publica SPF/DKIM/DMARC y envía desde aliases autorizados. Sin credenciales SMTP del usuario.',
  },
  {
    icon: Mail,
    title: 'Plantillas dinámicas',
    desc: 'Crea correos con variables {{nombre}}, {{enlace}} y un editor visual. Estándar y personalizadas por proyecto.',
  },
  {
    icon: Code2,
    title: 'SDK + API REST',
    desc: 'Integra en minutos con npm install matumailer. También disponible vía HTTP para cualquier stack.',
  },
  {
    icon: Users,
    title: 'Contactos y grupos',
    desc: 'Agenda destinatarios, arma segmentos y envía campañas a un grupo completo con una plantilla.',
  },
  {
    icon: Send,
    title: 'Envío masivo',
    desc: 'Lanza campañas a listas o grupos con control de entrega y cola durable. Disponible en Premium.',
    premium: true,
  },
  {
    icon: CalendarClock,
    title: 'Correos programados',
    desc: 'Agenda envíos y campañas: el worker procesa la cola aunque reinicies el dashboard.',
    premium: true,
  },
  {
    icon: BarChart3,
    title: 'Analíticas y tracking',
    desc: 'Aperturas, clics y logs con mensajes claros en español cuando algo falla.',
  },
  {
    icon: Sparkles,
    title: 'Brand kit',
    desc: 'Logo, color, header y footer globales que se aplican al renderizar cada plantilla.',
  },
  {
    icon: Shield,
    title: 'Identidades de envío',
    desc: 'Tokens de API por proyecto, aliases autorizados y cuotas por plan. El usuario nunca entrega contraseñas SMTP.',
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
    title: 'Verifica dominio y aliases',
    desc: 'Añade tu dominio, publica los DNS, crea aliases (hola@, soporte@) y marca un remitente predeterminado.',
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
  { label: 'DKIM por dominio', detail: 'Firma automática' },
  { label: 'SDK oficial npm', detail: 'Integración rápida' },
] as const;

export const FAQ_ITEMS = [
  {
    q: '¿Qué es MatuMailer y para quién es?',
    a: 'MatuMailer es infraestructura de correo pensada para desarrolladores: verificas tu dominio por DNS y envías desde aliases autorizados, sin montar ni compartir un servidor SMTP propio.',
  },
  {
    q: '¿Tiene plan gratuito?',
    a: 'Sí. Incluye 1 proyecto, 1 dominio verificado, aliases, plantillas personalizadas y correos de prueba. Ideal para integrar antes de escalar.',
  },
  {
    q: '¿Qué incluye MatuMailer Premium?',
    a: 'Proyectos ilimitados, envío masivo, correos programados, plantillas sin límite y cuota ampliada. Desde $25.000 COP/mes.',
  },
  {
    q: '¿Cómo envío correos?',
    a: 'Verifica tu dominio por DNS, crea aliases (ventas@tudominio.com) y usa la API o el SDK. MatuMailer firma DKIM y entrega por su relay. Nunca pedimos tu contraseña de Gmail ni SMTP.',
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
