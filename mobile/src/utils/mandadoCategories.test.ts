import { describe, expect, it } from 'vitest';

import {
  createMandadoItem,
  formatMandadoItem,
  mandadoItemToPayload,
} from './mandadoCategories';

describe('mandadoCategories', () => {
  it('muestra solo el nombre si no hay cantidad', () => {
    expect(formatMandadoItem({ name: 'Leche entera' })).toBe('Leche entera');
  });

  it('formatea por peso, piezas, litros y paquetes', () => {
    expect(formatMandadoItem({ name: 'Jitomate', quantity: '1.5', unit: 'kg' })).toBe('Jitomate 1.5kg');
    expect(formatMandadoItem({ name: 'Huevo', quantity: '2', unit: 'pza' })).toBe('Huevo (2 pza)');
    expect(formatMandadoItem({ name: 'Leche', quantity: '2', unit: 'lt' })).toBe('Leche 2 lt');
    expect(formatMandadoItem({ name: 'Arroz', quantity: '3', unit: 'paq' })).toBe('Arroz (3 paq)');
  });

  it('createMandadoItem omite medida si no se indica', () => {
    const item = createMandadoItem({ name: 'Cloro', category: 'limpieza', notes: 'marca X' });
    expect(item.quantity).toBeUndefined();
    expect(item.notes).toBe('marca X');
  });

  it('mandadoItemToPayload respeta notas y omite cantidad vacía', () => {
    const payload = mandadoItemToPayload(
      createMandadoItem({ name: 'Pan', category: 'abarrotes', notes: 'integral' }),
    );
    expect(payload).toEqual({
      name: 'Pan',
      category: 'abarrotes',
      notes: 'integral',
    });
  });
});
