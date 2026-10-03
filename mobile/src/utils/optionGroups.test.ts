import { describe, expect, it } from 'vitest';

import {
  effectiveMinSelect,
  isSkippableOptionGroup,
  looksLikeOptionalExtras,
  skipOptionLabel,
} from './optionGroups';

describe('optionGroups', () => {
  it('trata Extra/Toppings como opcionales aunque min_select sea 1', () => {
    expect(looksLikeOptionalExtras('Extra')).toBe(true);
    expect(looksLikeOptionalExtras('Extras')).toBe(true);
    expect(looksLikeOptionalExtras('Toppings')).toBe(true);
    expect(looksLikeOptionalExtras('Salsa')).toBe(true);
    expect(isSkippableOptionGroup({ name: 'Extra', min_select: 1 })).toBe(true);
    expect(effectiveMinSelect({ name: 'Extra', min_select: 1 })).toBe(0);
  });

  it('no permite saltar sabores ni tamaños obligatorios', () => {
    expect(looksLikeOptionalExtras('Sabor')).toBe(false);
    expect(looksLikeOptionalExtras('Guisos del día')).toBe(false);
    expect(looksLikeOptionalExtras('Tamaño')).toBe(false);
    expect(isSkippableOptionGroup({ name: 'Sabor', min_select: 1 })).toBe(false);
    expect(effectiveMinSelect({ name: 'Sabor', min_select: 1 })).toBe(1);
  });

  it('respeta min_select 0 en cualquier grupo', () => {
    expect(isSkippableOptionGroup({ name: 'Sabor', min_select: 0 })).toBe(true);
    expect(effectiveMinSelect({ name: 'Sabor', min_select: 0 })).toBe(0);
    expect(skipOptionLabel('Sabor')).toBe('Sin sabores');
  });

  it('etiqueta Sin extras / Sin toppings', () => {
    expect(skipOptionLabel('Extra')).toBe('Sin extras');
    expect(skipOptionLabel('Toppings')).toBe('Sin toppings');
    expect(skipOptionLabel('Queso extra')).toBe('Sin extras');
  });
});
