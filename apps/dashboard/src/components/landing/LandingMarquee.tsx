const ITEMS = [
  'SMTP Gmail · Outlook · Zoho',
  'Plantillas con {{variables}}',
  'SDK npm matumailer',
  'Envío masivo Premium',
  'Cola programada durable',
  'Brand kit por proyecto',
  'Tracking de aperturas y clics',
  'Logs en español claro',
  'Grupos de contactos',
  'Hecho en Colombia',
] as const;

export function LandingMarquee() {
  const loop = [...ITEMS, ...ITEMS];
  return (
    <section
      aria-label="Destacados del producto"
      className="border-y border-charcoal/10 bg-gradient-to-r from-gold/25 via-amber-100/80 to-gold/20"
    >
      <div className="overflow-hidden py-3.5">
        <div className="landing-marquee-track flex w-max gap-10 whitespace-nowrap px-4">
          {loop.map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="inline-flex items-center gap-3 text-sm font-semibold tracking-wide text-charcoal"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-charcoal/70" aria-hidden />
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
