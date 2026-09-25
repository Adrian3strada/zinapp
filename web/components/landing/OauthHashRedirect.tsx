'use client';

import { useEffect } from 'react';

export function OauthHashRedirect() {
  useEffect(() => {
    const hash = window.location.hash || '';
    if (!hash) return;
    if (
      /[#&](id_token|access_token|code)=/.test(hash) ||
      (/[#&]state=/.test(hash) && /[#&]iss=/.test(hash))
    ) {
      window.location.replace(`/app/${hash}`);
    }
  }, []);
  return null;
}
