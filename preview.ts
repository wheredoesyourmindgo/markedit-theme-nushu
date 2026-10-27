import { MarkEdit } from 'markedit-api';
import type { Colors } from 'markedit-theming/dist/colors';
import type { Palette } from './colors';

// Styles for the preview pane of the MarkEdit Preview extension (markedit-preview). The pane is a
// .markdown-body element outside the editor, so EditorView themes don't reach it; this adds a page
// stylesheet instead. Its default style is GitHub's markdown CSS, built on Primer color variables,
// so most colors are set by overriding those variables. Code blocks use highlight.js's GitHub theme,
// which hard-codes its colors, so those classes get their own rules. The syntax-hidden mode's inline
// tables and HTML render in shadow roots this can't reach.
//
// ":root .markdown-body" outranks the extension's ".markdown-body" rules wherever they're added.

const pane = ':root .markdown-body';

function previewStyles(palette: Palette, colors: Colors) {
  const s = palette.syntax;
  const rule = (selectors: string[], body: string) =>
    `${selectors.map(selector => `${pane} ${selector}`.trimEnd()).join(', ')} { ${body} }`;
  const color = (value: string) => `color: ${value} !important;`;
  const background = colors.editor?.backgroundColor ?? 'Canvas';

  return [
    `${pane} {
      --fgColor-default: ${palette.text};
      --fgColor-muted: ${palette.mutedText};
      --fgColor-accent: ${palette.textLink};
      --bgColor-default: ${background};
      --bgColor-muted: ${palette.widgetBackground};
      --bgColor-neutral-muted: ${palette.codeBackground};
      --borderColor-default: ${palette.border};
      --borderColor-muted: ${palette.border};
      color: ${palette.text};
      background-color: ${background};
    }`,
    // Match the editor: blue headings, purple link text, blue inline code, faint rules
    rule(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'], color(palette.heading)),
    rule(['a', 'a code'], color(palette.function)),
    rule([':not(pre) > code'], color(palette.inlineCode)),
    rule(['hr'], `background-color: ${palette.lineNumber} !important;`),
    // The quote bar uses the magenta of the editor's > markers, softened to 60%; the default border gray barely shows
    rule(['blockquote'], `border-left-color: ${palette.keyword}99 !important;`),
    // Code blocks use the editor's code block shade; the code inside drops highlight.js's own background
    rule(['pre'], `${color(palette.text)} background-color: ${palette.widgetBackground} !important;`),
    rule(['pre code', '.hljs'], `${color(palette.text)} background: transparent !important;`),
    // highlight.js classes, grouped as in its GitHub theme, with Nushu's code colors
    rule(['.hljs-doctag', '.hljs-keyword', '.hljs-meta .hljs-keyword', '.hljs-template-tag',
      '.hljs-template-variable', '.hljs-variable.language_', '.hljs-operator'], color(s.keyword)),
    rule(['.hljs-title', '.hljs-title.class_', '.hljs-title.class_.inherited__', '.hljs-title.function_',
      '.hljs-selector-tag', '.hljs-selector-class', '.hljs-selector-id', '.hljs-selector-pseudo'], color(s.function)),
    rule(['.hljs-attr', '.hljs-literal', '.hljs-meta', '.hljs-number', '.hljs-selector-attr', '.hljs-type',
      '.hljs-built_in', '.hljs-symbol'], color(s.constant)),
    rule(['.hljs-attribute', '.hljs-variable', '.hljs-subst', '.hljs-emphasis', '.hljs-strong'], color(palette.text)),
    rule(['.hljs-regexp', '.hljs-string', '.hljs-meta .hljs-string'], color(s.string)),
    rule(['.hljs-comment', '.hljs-code', '.hljs-formula'], color(s.comment)),
    rule(['.hljs-name'], color(s.tag)),
    rule(['.hljs-quote', '.hljs-bullet'], color(palette.mutedText)),
    rule(['.hljs-section'], color(palette.heading)),
    rule(['.hljs-addition'], `${color(palette.insertedText)} background-color: ${palette.insertedBackground} !important;`),
    rule(['.hljs-deletion'], `${color(palette.deletedText)} background-color: ${palette.deletedBackground} !important;`),
  ].join('\n');
}

export function nushuPreview(light: { palette: Palette, colors: Colors }, dark: { palette: Palette, colors: Colors }) {
  const settings = (MarkEdit.userSettings?.['extension.markeditThemeNushu'] ?? {}) as { enabledMode?: string };
  const mode = settings.enabledMode ?? 'both';
  const css: string[] = [];
  if (mode === 'both' || mode === 'light') {
    css.push(`@media (prefers-color-scheme: light) {\n${previewStyles(light.palette, light.colors)}\n}`);
  }
  if (mode === 'both' || mode === 'dark') {
    css.push(`@media (prefers-color-scheme: dark) {\n${previewStyles(dark.palette, dark.colors)}\n}`);
  }

  if (css.length > 0) {
    const style = document.createElement('style');
    style.id = 'nushu-preview-theme';
    style.textContent = css.join('\n');
    document.head.appendChild(style);
  }
}
