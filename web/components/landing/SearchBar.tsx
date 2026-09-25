'use client';

import { useEffect, useState } from 'react';
import { fold } from '@/lib/catalog';
import { useCatalog } from './Catalog';

const SUGGESTIONS = ['Tacos', 'Pizza', 'Café', 'Peluquería', 'Abarrotes'];

export function SearchBar() {
  const { filter, applySearch } = useCatalog();
  const [value, setValue] = useState(filter.query);

  useEffect(() => {
    setValue(filter.query);
  }, [filter.query]);

  return (
    <div className="hero-search-wrap">
      <form
        className="hero-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          applySearch(value);
        }}
      >
        <label className="sr-only" htmlFor="landing-q">
          Buscar en ZinApp
        </label>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          id="landing-q"
          name="q"
          type="search"
          value={value}
          placeholder="¿Qué se te antoja? Tacos, pizza, taller…"
          autoComplete="off"
          onChange={(event) => setValue(event.target.value)}
        />
        <button className="btn btn-primary btn-sm" type="submit">
          Buscar
        </button>
      </form>
      <p className="search-chips" aria-label="Sugerencias">
        {SUGGESTIONS.map((item) => (
          <button
            key={item}
            type="button"
            className={fold(filter.query) === fold(item) ? 'is-active' : undefined}
            onClick={() => applySearch(item)}
          >
            {item}
          </button>
        ))}
      </p>
    </div>
  );
}
