// Generates colors.ts from the Nushu VS Code themes, which are the source of truth.
//
// Usage: node scripts/sync-colors.mjs [path/to/nushu-vscode-theme/themes]
// Defaults to ../nushu-vscode-theme/themes, or NUSHU_THEMES_DIR when set.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const themesDir = resolve(process.argv[2] ?? process.env.NUSHU_THEMES_DIR ?? join(rootDir, '../nushu-vscode-theme/themes'));

// MarkEdit-theming highlight key -> TextMate scope it takes its color from
const highlightScopes = {
  heading: 'markup.heading',
  bold: 'markup.bold',
  italic: 'markup.italic',
  quote: 'markup.quote',
  link: 'string.other.link',
  divider: 'punctuation.definition.list.begin.markdown',
  comment: 'comment',
  meta: 'punctuation.definition.list.begin.markdown',
  keyword: 'keyword',
  atom: 'constant.language',
  literal: 'constant.numeric',
  string: 'string',
  special: 'constant.character',
  variable: 'variable',
  local: 'variable.other',
  type: 'entity.name.type',
  class: 'entity.name.class',
  macro: 'meta.preprocessor',
  property: 'support.type.property-name',
  label: 'entity.name.label',
  operator: 'keyword.operator',
  constant: 'constant',
  // MarkEdit-theming also colors markdown syntax markers (#, **, -, >) with this
  instruction: 'punctuation.definition.list.begin.markdown',
  invalid: 'invalid.illegal',
};

// Named colors for the styles in theme.ts that MarkEdit-theming has no setting for
function paletteColors(theme) {
  const colors = theme.colors;
  const token = (scope, field) => tokenColor(theme.tokenColors, scope, field);
  return {
    text: colors['editor.foreground'],
    mutedText: token('punctuation.definition.list.begin.markdown'),
    activeLineBackground: colors['editor.lineHighlightBackground'],
    lineNumber: colors['editorLineNumber.foreground'],
    activeLineNumber: colors['editorLineNumber.activeForeground'],
    widgetBackground: colors['editorWidget.background'],
    border: colors['panel.border'],
    codeBackground: colors['textCodeBlock.background'],
    textLink: colors['textLink.foreground'],
    command: colors['terminal.ansiCyan'],
    heading: token('markup.heading'),
    quote: token('markup.quote'),
    inlineCode: token('markup.inline.raw'),
    link: token('string.other.link'),
    comment: token('comment'),
    keyword: token('keyword'),
    constant: token('constant'),
    string: token('string'),
    function: token('entity.name.function'),
    tag: token('entity.name.tag'),
    insertedText: token('markup.inserted'),
    insertedBackground: token('markup.inserted', 'background'),
    deletedText: token('markup.deleted'),
    deletedBackground: token('markup.deleted', 'background'),
  };
}

function editorColors(colors) {
  const background = colors['editor.background'];
  return {
    textColor: colors['editor.foreground'],
    backgroundColor: background,
    activeLineBackground: colors['editor.lineHighlightBackground'],
    caretColor: colors['editorCursor.foreground'],
    selectionBackground: colors['editor.selectionBackground'],
    matchingBracketBackground: colors['editorBracketMatch.background'],
    gutterText: colors['editorLineNumber.foreground'],
    gutterBackground: colors['editorGutter.background'] ?? background,
    foldPlaceholderText: colors['editorLineNumber.foreground'],
    foldPlaceholderBackground: colors['editorWidget.background'],
    searchMatchBackground: colors['editor.findMatchHighlightBackground'],
    selectionMatchBackground: colors['editor.selectionHighlightBackground'],
    visibleSpaceColor: colors['editorWhitespace.foreground'],
  };
}

// Resolves a scope the way TextMate themes do for simple selectors:
// the most specific matching selector wins, and later rules win ties.
// Descendant selectors (containing spaces) are ignored.
function tokenColor(tokenColors, scope, field = 'foreground') {
  let best;
  tokenColors.forEach(rule => {
    if (!rule.settings?.[field]) {
      return;
    }

    const selectors = [rule.scope ?? []].flat().flatMap(s => s.split(',')).map(s => s.trim());
    selectors.filter(s => !s.includes(' ')).forEach(selector => {
      if ((scope === selector || scope.startsWith(`${selector}.`)) && selector.length >= (best?.length ?? 0)) {
        best = { length: selector.length, color: rule.settings[field] };
      }
    });
  });

  return best?.color;
}

function themeColors(file) {
  const theme = JSON.parse(readFileSync(join(themesDir, file), 'utf8'));
  const highlight = Object.fromEntries(
    Object.entries(highlightScopes)
      .map(([key, scope]) => [key, tokenColor(theme.tokenColors, scope)])
      .filter(([, color]) => color !== undefined),
  );

  return {
    colors: { editor: editorColors(theme.colors), highlight },
    palette: paletteColors(theme),
  };
}

const light = themeColors('nushu-light.json');
const dark = themeColors('nushu-dark.json');
const json = value => JSON.stringify(value, null, 2);

const output = `// Generated by scripts/sync-colors.mjs from the Nushu VS Code themes. Do not edit.

import type { Colors } from 'markedit-theming/dist/colors';

export const lightColors: Colors = ${json(light.colors)};

export const darkColors: Colors = ${json(dark.colors)};

export const lightPalette = ${json(light.palette)};

export const darkPalette: Palette = ${json(dark.palette)};

export type Palette = typeof lightPalette;
`;

writeFileSync(join(rootDir, 'colors.ts'), output);
console.log(`Wrote colors.ts from ${themesDir}`);
