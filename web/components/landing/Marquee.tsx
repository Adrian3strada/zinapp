type MarqueeProps = {
  items: string[];
  halloween?: boolean;
};

export function Marquee({ items, halloween = false }: MarqueeProps) {
  const unique = [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  if (unique.length < 2) return null;

  const row = [...unique, ...unique, ...unique];

  return (
    <section className="ticker-band" aria-label="Negocios publicados en ZinApp">
      <p className="ticker-label">{halloween ? '🎃 Antojos de octubre' : 'Ahora en ZinApp'}</p>
      <div className="marquee">
        <div className="marquee-track">
          {row.map((name, index) => (
            <span key={`${name}-${index}`}>{name}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
