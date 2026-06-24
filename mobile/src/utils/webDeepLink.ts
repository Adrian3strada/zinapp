/** Lee token de restablecimiento desde la URL en web (?reset=...). */
export function getWebResetToken(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get('reset') ?? params.get('token');
  return token?.trim() || null;
}

export function clearWebResetTokenFromUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('reset');
  url.searchParams.delete('token');
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, '', next);
}
