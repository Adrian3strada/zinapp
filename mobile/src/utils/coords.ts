/** Redondea coordenadas GPS al formato que acepta el backend (6 decimales). */
export function roundCoordinate(value: number): string {
  return Number(value.toFixed(6)).toFixed(6);
}
