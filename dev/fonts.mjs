const FONT_LIBRARY = {
  roboto_n4: { handle: 'roboto_n4', family: 'Roboto', fallback_families: 'sans-serif', style: 'normal', weight: 400, 'system?': false },
  roboto_i4: { handle: 'roboto_i4', family: 'Roboto', fallback_families: 'sans-serif', style: 'italic', weight: 400, 'system?': false },
  roboto_n7: { handle: 'roboto_n7', family: 'Roboto', fallback_families: 'sans-serif', style: 'normal', weight: 700, 'system?': false },
  roboto_i7: { handle: 'roboto_i7', family: 'Roboto', fallback_families: 'sans-serif', style: 'italic', weight: 700, 'system?': false },
  josefin_sans_n4: { handle: 'josefin_sans_n4', family: 'Josefin Sans', fallback_families: 'sans-serif', style: 'normal', weight: 400, 'system?': false },
  josefin_sans_i4: { handle: 'josefin_sans_i4', family: 'Josefin Sans', fallback_families: 'sans-serif', style: 'italic', weight: 400, 'system?': false },
  josefin_sans_n7: { handle: 'josefin_sans_n7', family: 'Josefin Sans', fallback_families: 'sans-serif', style: 'normal', weight: 700, 'system?': false },
  josefin_sans_i7: { handle: 'josefin_sans_i7', family: 'Josefin Sans', fallback_families: 'sans-serif', style: 'italic', weight: 700, 'system?': false },
};

const FONT_VARIANTS = {
  roboto_n4: { bold: 'roboto_n7', italic: 'roboto_i4', bold_italic: 'roboto_i7' },
  roboto_n7: { bold: 'roboto_n7', italic: 'roboto_i7', bold_italic: 'roboto_i7' },
  roboto_i4: { bold: 'roboto_i7', italic: 'roboto_i4', bold_italic: 'roboto_i7' },
  roboto_i7: { bold: 'roboto_i7', italic: 'roboto_i7', bold_italic: 'roboto_i7' },
  josefin_sans_n4: { bold: 'josefin_sans_n7', italic: 'josefin_sans_i4', bold_italic: 'josefin_sans_i7' },
  josefin_sans_n7: { bold: 'josefin_sans_n7', italic: 'josefin_sans_i7', bold_italic: 'josefin_sans_i7' },
  josefin_sans_i4: { bold: 'josefin_sans_i7', italic: 'josefin_sans_i4', bold_italic: 'josefin_sans_i7' },
  josefin_sans_i7: { bold: 'josefin_sans_i7', italic: 'josefin_sans_i7', bold_italic: 'josefin_sans_i7' },
};

export const GOOGLE_FONTS_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Josefin+Sans:ital,wght@0,400;0,700;1,400;1,700&family=Roboto:ital,wght@0,400;0,700;1,400;1,700&display=swap';

export function resolveFont(font) {
  if (!font) return FONT_LIBRARY.roboto_n4;
  if (typeof font === 'object') return font;
  return FONT_LIBRARY[font] ?? FONT_LIBRARY.roboto_n4;
}

export function modifyFont(font, property, value) {
  const resolved = resolveFont(font);
  const handle = resolved.handle ?? (typeof font === 'string' ? font : null);
  const variants = handle ? FONT_VARIANTS[handle] : null;

  if (property === 'weight' && value === 'bold') {
    if (variants?.bold) return resolveFont(variants.bold);
    return { ...resolved, weight: 700 };
  }

  if (property === 'style' && value === 'italic') {
    if (resolved.style === 'italic') return resolved;
    if (variants?.italic) return resolveFont(variants.italic);
    return { ...resolved, style: 'italic' };
  }

  return resolved;
}

export function expandSettings(settings) {
  const expanded = { ...settings };

  for (const [key, value] of Object.entries(expanded)) {
    if (typeof value === 'string' && (key.includes('font') || value.includes('_n') || value.includes('_i'))) {
      expanded[key] = resolveFont(value);
    }
  }

  return expanded;
}
