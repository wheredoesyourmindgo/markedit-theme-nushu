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

// Code block token group (see syntaxTags in syntax.ts) -> TextMate scope VS Code gives the same code.
// Groups whose scope has no color in the theme fall back to the editor text color.
const syntaxScopes = {
  comment: 'comment',
  keyword: 'keyword',
  operator: 'keyword.operator',
  punctuation: 'punctuation',
  embedded: 'punctuation.section.embedded',
  string: 'string',
  regexp: 'string.regexp',
  escape: 'constant.character.escape',
  constant: 'constant.language',
  number: 'constant.numeric',
  unit: 'keyword.other.unit',
  builtin: 'support.function.builtin',
  variable: 'variable.other.readwrite',
  definition: 'variable.other.constant',
  function: 'entity.name.function',
  // JSON keys, CSS properties and JS member access share a tag; follow VS Code's CSS properties
  property: 'support.type.property-name.css',
  // Object keys, class members, methods and YAML keys share a tag; follow VS Code's object keys
  key: 'meta.object-literal.key',
  type: 'entity.name.type',
  class: 'entity.other.attribute-name.class',
  label: 'entity.other.attribute-name.id',
  namespace: 'entity.name.namespace',
  tag: 'entity.name.tag',
  attribute: 'entity.other.attribute-name',
  // The shell highlighter tags #! lines as meta, the same tag as diff @@ lines
  meta: 'comment.line.shebang',
};

// Returns `color` with the alpha that makes it look like `target` over `background`.
// Code blocks need a translucent background so the selection layer behind them shows through.
function translucent(color, target, background) {
  const channels = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const [c, t, b] = [color, target, background].map(channels);
  const alphas = c.map((value, i) => (value === b[i] ? 0 : (t[i] - b[i]) / (value - b[i])));
  const alpha = Math.min(1, Math.max(0, alphas.reduce((sum, a) => sum + a, 0) / alphas.length));
  return `${color.slice(0, 7)}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

// Named colors for the styles in theme.ts and syntax.ts that MarkEdit-theming has no setting for
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
    codeBlockBackground: translucent(
      colors['editor.foreground'], colors['editorWidget.background'], colors['editor.background'],
    ),
    border: colors['panel.border'],
    codeBackground: colors['textCodeBlock.background'],
    textLink: colors['textLink.foreground'],
    // Shell expansions and commands (see shellRanges in syntax.ts)
    shellVariable: token('variable.other.normal.shell'),
    shellVariablePunctuation: token('punctuation.definition.variable.shell'),
    shellCommand: token('entity.name.command.shell'),
    // Selectors in CSS code blocks; VS Code scopes the rule to CSS, so match it exactly
    cssSelector: ruleColor(theme.tokenColors, 'source.css entity.name.tag'),
    heading: token('markup.heading'),
    quote: token('markup.quote'),
    inlineCode: token('markup.inline.raw'),
    keyword: token('keyword'),
    function: token('entity.name.function'),
    // Diffs use VS Code's diff view colors rather than the markup.inserted/deleted token colors
    insertedText: colors['editor.foreground'],
    insertedBackground: colors['diffEditor.insertedTextBackground'],
    deletedText: colors['editor.foreground'],
    deletedBackground: colors['diffEditor.removedTextBackground'],
    // Keys in JSON and YAML code blocks (see languageAliases in syntax.ts)
    jsonKey: token('support.type.property-name.json'),
    yamlKey: token('entity.name.tag.yaml'),
    rubyConstant: token('variable.other.constant.ruby'),
    syntax: Object.fromEntries(
      Object.entries(syntaxScopes).map(([name, scope]) => [name, token(scope) ?? colors['editor.foreground']]),
    ),
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

// Returns the color of the rule that lists `selector` exactly, for descendant selectors tokenColor ignores
function ruleColor(tokenColors, selector, field = 'foreground') {
  const rule = tokenColors.findLast(rule => [rule.scope ?? []].flat().some(s => s.trim() === selector));
  return rule?.settings?.[field];
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
