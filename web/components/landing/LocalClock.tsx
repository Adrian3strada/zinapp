'use client';

import { useEffect, useState } from 'react';

export function LocalClock() {
  const [label, setLabel] = useState('');

  useEffect(() => {
    function tick() {
      setLabel(
        new Intl.DateTimeFormat('es-MX', {
          timeZone: 'America/Mexico_City',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).format(new Date()),
      );
    }
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!label) return null;
  return <span className="local-clock">{label}</span>;
}
