'use client';

import { useReducedMotion } from 'motion/react';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { useState } from 'react';

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
};

export function SpotlightCard({ children, className }: SpotlightCardProps) {
  const reduce = useReducedMotion();
  const [spot, setSpot] = useState({ x: 50, y: 30, on: false });

  function onMove(event: MouseEvent<HTMLDivElement>) {
    if (reduce) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setSpot({ x, y, on: true });
  }

  const style = {
    '--spot-x': `${spot.x}%`,
    '--spot-y': `${spot.y}%`,
    '--spot-opacity': spot.on && !reduce ? 1 : 0,
  } as CSSProperties;

  return (
    <div
      className={`spotlight-card${className ? ` ${className}` : ''}`}
      style={style}
      onMouseMove={onMove}
      onMouseLeave={() => setSpot((current) => ({ ...current, on: false }))}
    >
      {children}
    </div>
  );
}
