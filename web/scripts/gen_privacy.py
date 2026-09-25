"""Generate Next.js privacy CSS + HTML renderer from the Django template."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
src = (ROOT / 'backend/config/templates/legal/privacidad.html').read_text(encoding='utf-8')

style_match = re.search(r'<style>(.*?)</style>', src, re.S)
if not style_match:
    raise SystemExit('No <style> block found')

css = style_match.group(1).strip() + '\n'
css_path = ROOT / 'web/app/privacidad/privacidad.css'
css_path.parent.mkdir(parents=True, exist_ok=True)
css_path.write_text(css, encoding='utf-8')

body_match = re.search(r'<body>(.*)</body>', src, re.S)
if not body_match:
    raise SystemExit('No <body> found')
body = body_match.group(1)
body = body.replace('{% load static %}', '')
body = re.sub(r'\{#.*?#\}', '', body, flags=re.S)
body = re.sub(
    r'\{\%\s*if stripe_payments_enabled\s*\%\}(.*?)\{\%\s*else\s*\%\}(.*?)\{\%\s*endif\s*\%\}',
    lambda m: f'<!--STRIPE_START-->{m.group(1)}<!--STRIPE_ELSE-->{m.group(2)}<!--STRIPE_END-->',
    body,
    flags=re.S,
)
body = body.replace('{{ privacy_email }}', '__PRIVACY_EMAIL__')
body = body.replace('{{ support_email }}', '__SUPPORT_EMAIL__')
body = body.replace('{{ site_url }}', '__SITE_URL__')
body = body.strip()

ts = f'''\
function escapeHtml(value: string): string {{
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}}

const TEMPLATE = {json.dumps(body)};

type PrivacyHtmlArgs = {{
  privacyEmail: string;
  supportEmail: string;
  siteUrl: string;
  stripeEnabled: boolean;
}};

export function renderPrivacyHtml({{
  privacyEmail,
  supportEmail,
  siteUrl,
  stripeEnabled,
}}: PrivacyHtmlArgs): string {{
  const withStripe = TEMPLATE.replace(
    /<!--STRIPE_START-->([\\s\\S]*?)<!--STRIPE_ELSE-->([\\s\\S]*?)<!--STRIPE_END-->/g,
    (_match, enabledBlock: string, disabledBlock: string) =>
      stripeEnabled ? enabledBlock : disabledBlock,
  );
  return withStripe
    .replaceAll('__PRIVACY_EMAIL__', escapeHtml(privacyEmail))
    .replaceAll('__SUPPORT_EMAIL__', escapeHtml(supportEmail))
    .replaceAll('__SITE_URL__', escapeHtml(siteUrl));
}}
'''

out = ROOT / 'web/lib/privacyHtml.ts'
out.write_text(ts, encoding='utf-8')
print(f'Wrote {css_path}')
print(f'Wrote {out} ({out.stat().st_size} bytes)')
