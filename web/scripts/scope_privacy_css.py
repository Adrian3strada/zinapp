from pathlib import Path

p = Path('web/app/privacidad/privacidad.css')
css = p.read_text(encoding='utf-8')
out: list[str] = []
for chunk in css.split('}'):
    if not chunk.strip():
        continue
    if '{' not in chunk:
        out.append(chunk)
        continue
    sel, rest = chunk.split('{', 1)
    raw = sel.strip()
    if (
        raw.startswith(':root')
        or raw == '*'
        or raw.startswith('html')
        or raw.startswith('body')
        or raw.startswith('@media')
        or raw.startswith('@')
    ):
        out.append(chunk + '}')
        continue
    selectors = [s.strip() for s in raw.split(',') if s.strip()]
    prefixed = ', '.join(
        s if s.startswith('.privacy-doc') or s.startswith(':') else f'.privacy-doc {s}'
        for s in selectors
    )
    out.append(f'\n{prefixed} {{{rest}}}')

text = ''.join(out)
if not text.endswith('\n'):
    text += '\n'
text += """
body:has(.privacy-doc) {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  line-height: 1.7;
  color: var(--text);
  background: var(--bg);
  padding-bottom: env(safe-area-inset-bottom, 0px) !important;
}
.privacy-doc { min-height: 100vh; background: var(--bg); }
"""
p.write_text(text, encoding='utf-8')
print('scoped', p.stat().st_size)
