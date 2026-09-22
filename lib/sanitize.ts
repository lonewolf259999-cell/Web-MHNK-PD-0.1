/* Allowlist sanitizer for rich text authored in Google Sheets.

   Staff type real HTML into the sheet cells (bold, colored spans), so the
   text has to render as markup rather than be escaped. Everything is escaped
   first, then only the allowed tags are restored — anything else, including
   script tags and event handlers, stays inert text.

   Pure string operations, so this runs during server rendering too. */

const ALLOWED_SIMPLE_TAGS = ['b', 'strong', 'i', 'em', 'u'] as const;

/** CSS colors only: named colors, #hex, rgb()/rgba(), hsl()/hsla(). */
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\))$/i;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return '';

  let out = escapeHtml(html);

  for (const tag of ALLOWED_SIMPLE_TAGS) {
    out = out
      .replace(new RegExp(`&lt;${tag}&gt;`, 'gi'), `<${tag}>`)
      .replace(new RegExp(`&lt;/${tag}&gt;`, 'gi'), `</${tag}>`);
  }

  out = out.replace(/&lt;br\s*\/?&gt;/gi, '<br>');

  // <span style="color: …"> — the colour value is validated, not trusted.
  out = out.replace(
    /&lt;span\s+style=(?:&quot;|&#39;)color\s*:\s*([^&]+?)(?:&quot;|&#39;)\s*&gt;/gi,
    (match, rawColor: string) => {
      const color = rawColor.trim();
      return SAFE_COLOR.test(color) ? `<span style="color: ${color}">` : match;
    }
  );
  out = out.replace(/&lt;\/span&gt;/gi, '</span>');

  return out;
}
