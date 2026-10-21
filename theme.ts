import { EditorView } from '@codemirror/view';
import type { Palette } from './colors';

// Styles that MarkEdit-theming has no color setting for. Rule order matters:
// later rules win ties, so .tok-meta keeps syntax markers muted.
export function nushuTheme(palette: Palette, options?: { dark: boolean }) {
  const important = (value: string) => `${value} !important`;
  const color = (value: string) => ({ color: important(value) });

  return EditorView.theme({
    // Editor chrome

    '.cm-activeLineGutter': {
      backgroundColor: important(palette.activeLineBackground),
      color: important(palette.activeLineNumber),
    },
    '.cm-panels': {
      backgroundColor: important(palette.widgetBackground),
      color: important(palette.text),
      borderColor: important(palette.border),
    },

    // Markdown

    '.cm-md-header': { ...color(palette.heading), fontWeight: 'bold' },
    '.cm-md-bold': { ...color(palette.text), fontWeight: 'bold' },
    '.cm-md-italic': { ...color(palette.text), fontStyle: 'italic' },
    '.cm-md-strikethrough': { textDecoration: 'line-through' },
    // MarkEdit italicizes quotes, but the preview doesn't, so only real emphasis stays italic
    '.cm-md-quote': { ...color(palette.quote), fontStyle: 'normal' },
    '.cm-md-quote.cm-md-italic, .cm-md-quote .cm-md-italic': { fontStyle: 'italic' },
    // Marks inside a quote (like **) stay muted instead of taking the quote gold
    '.cm-md-quote.tok-meta, .cm-md-quote .tok-meta': color(palette.mutedText),
    // Quote marks (>) use the keyword magenta. .tok-meta is repeated to outrank the muted rule.
    '.cm-md-quoteMark, .cm-md-quoteMark.tok-meta': color(palette.keyword),
    '.cm-md-listMark, .cm-md-taskMarker': color(palette.mutedText),
    // .cm-md-link is MarkEdit's clickable-link span, nested inside these and covering the whole
    // link, so it's left uncolored. Marks and URLs can also carry .tok-link, so their rules come after.
    // Link text is purple rather than VS Code's light blue, so it stands apart from the URL.
    '.tok-link': color(palette.function),
    '.cm-md-linkMark': color(palette.mutedText),
    '.cm-md-url, .tok-url': { ...color(palette.textLink), textDecoration: 'underline' },
    '.cm-md-inlineCode': {
      ...color(palette.inlineCode),
      backgroundColor: important(palette.codeBackground),
    },
    '.cm-md-codeBlockWrapper, .cm-md-frontMatterWrapper': {
      backgroundColor: important(palette.widgetBackground),
      borderColor: important(palette.border),
    },
    '.cm-md-codeBlock, .cm-md-frontMatter': color(palette.text),
    // The shell highlighter tags $(...) and backticks as a quote; color them as commands, in the terminal cyan
    '.cm-md-codeBlock .cm-md-quote': color(palette.command),
    '.cm-md-tableWrapper': { borderColor: important(palette.border) },
    // Table pipes and the divider row use the tag gold. .tok-meta is repeated to outrank the muted rule.
    '.cm-md-tableMark, .cm-md-tableMark.tok-meta': color(palette.tag),
    '.cm-md-horizontalRule': color(palette.lineNumber),

    // Fenced code syntax (CodeMirror classHighlighter)

    '.tok-comment': color(palette.comment),
    '.tok-keyword, .tok-modifier, .tok-operatorKeyword, .tok-controlKeyword': color(palette.keyword),
    '.tok-string, .tok-string2': color(palette.string),
    '.tok-number, .tok-bool, .tok-atom, .tok-literal, .tok-propertyName, .tok-typeName, .tok-className': color(palette.constant),
    '.tok-variableName': color(palette.text),
    '.tok-variableName.tok-definition': color(palette.mutedText),
    '.tok-function, .tok-variableName.tok-function': color(palette.function),
    '.tok-tagName, .tok-macroName': color(palette.tag),
    '.tok-meta, .tok-punctuation': color(palette.mutedText),
    '.tok-inserted': {
      ...color(palette.insertedText),
      backgroundColor: important(palette.insertedBackground),
    },
    '.tok-deleted': {
      ...color(palette.deletedText),
      backgroundColor: important(palette.deletedBackground),
    },
  }, options);
}
