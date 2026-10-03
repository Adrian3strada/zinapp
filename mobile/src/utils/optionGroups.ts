/** Grupos que el cliente puede dejar vacíos (extras), aunque vengan como min_select=1. */

const SKIPPABLE_GROUP =
  /\b(extra|extras|topping|toppings|adicional|adicionales|complemento|complementos|salsa|salsas|aderezo|aderezos)\b/;

export function foldOptionGroupName(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function looksLikeOptionalExtras(name: string): boolean {
  return SKIPPABLE_GROUP.test(foldOptionGroupName(name));
}

export function isSkippableOptionGroup(group: { name: string; min_select: number }): boolean {
  if (group.min_select <= 0) return true;
  return looksLikeOptionalExtras(group.name);
}

export function effectiveMinSelect(group: { name: string; min_select: number }): number {
  return isSkippableOptionGroup(group) ? 0 : group.min_select;
}

export function skipOptionLabel(groupName: string): string {
  const folded = foldOptionGroupName(groupName);
  if (/\bextras?\b/.test(folded)) return 'Sin extras';
  if (/\btoppings?\b/.test(folded)) return 'Sin toppings';
  if (/\bsalsas?\b/.test(folded)) return 'Sin salsas';
  if (/\baderezos?\b/.test(folded)) return 'Sin aderezo';
  if (/\badicional(es)?\b/.test(folded)) return 'Sin adicionales';
  if (/\bcomplementos?\b/.test(folded)) return 'Sin complemento';
  if (/\bsabor(es)?\b/.test(folded)) return 'Sin sabores';
  const trimmed = groupName.trim();
  return trimmed ? `Sin ${trimmed.toLowerCase()}` : 'Ninguno';
}
