import { describe, expect, it } from 'vitest';

import { decodeJwtPayload, isAccessTokenExpiringSoon } from './jwt';

function makeToken(expSecondsFromNow: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow }),
  ).toString('base64url');
  return `${header}.${payload}.sig`;
}

describe('jwt helpers', () => {
  it('decodeJwtPayload lee exp', () => {
    const token = makeToken(600);
    const payload = decodeJwtPayload(token);
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('no renueva si el access tiene margen (>120s)', () => {
    expect(isAccessTokenExpiringSoon(makeToken(600))).toBe(false);
  });

  it('marca por vencer dentro del skew', () => {
    expect(isAccessTokenExpiringSoon(makeToken(60))).toBe(true);
  });

  it('sin token o basura → por vencer', () => {
    expect(isAccessTokenExpiringSoon(null)).toBe(true);
    expect(isAccessTokenExpiringSoon('not-a-jwt')).toBe(true);
  });

  it('skew 0 solo mira si ya expiró', () => {
    expect(isAccessTokenExpiringSoon(makeToken(30), 0)).toBe(false);
    expect(isAccessTokenExpiringSoon(makeToken(-5), 0)).toBe(true);
  });
});
