import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { syntaxHighlighting, syntaxTree } from '@codemirror/language';
import { tagHighlighter, tags as t, type Tag } from '@lezer/highlight';
import { RangeSet, RangeSetBuilder, type Extension } from '@codemirror/state';
import type { Palette } from './colors';

type SyntaxGroup = keyof Palette['syntax'];

// Lezer highlight tags for each color group. The groups mirror syntaxScopes in
// scripts/sync-colors.mjs, which takes each group's color from the VS Code theme.
// The more specific tag wins, so function(variableName) beats variableName.
const syntaxTags: Record<SyntaxGroup, Tag[]> = {
  comment: [t.comment, t.lineComment, t.blockComment, t.docComment],
  keyword: [
    t.keyword, t.controlKeyword, t.operatorKeyword, t.definitionKeyword, t.moduleKeyword, t.modifier,
    t.function(t.punctuation), // =>
  ],
  operator: [
    t.operator, t.arithmeticOperator, t.logicOperator, t.bitwiseOperator, t.compareOperator,
    t.updateOperator, t.definitionOperator, t.typeOperator, t.controlOperator,
  ],
  punctuation: [
    t.punctuation, t.separator, t.bracket, t.paren, t.squareBracket, t.brace, t.angleBracket, t.derefOperator,
  ],
  embedded: [t.special(t.brace)], // ${ } in template strings
  string: [t.string, t.special(t.string), t.docString, t.attributeValue, t.character, t.content],
  regexp: [t.regexp],
  escape: [t.escape],
  constant: [t.bool, t.null, t.atom, t.self, t.color, t.constant(t.name), t.standard(t.name)],
  number: [t.number, t.integer, t.float],
  unit: [t.unit],
  builtin: [t.standard(t.variableName)],
  variable: [t.variableName, t.special(t.variableName), t.local(t.variableName)],
  definition: [t.definition(t.variableName)],
  function: [
    t.function(t.variableName), t.function(t.propertyName), t.function(t.definition(t.variableName)), t.macroName,
  ],
  property: [t.propertyName, t.special(t.propertyName)],
  key: [t.definition(t.propertyName), t.definition(t.special(t.propertyName))],
  type: [t.typeName, t.definition(t.typeName)],
  class: [t.className, t.definition(t.className), t.constant(t.className)],
  label: [t.labelName],
  namespace: [t.namespace],
  tag: [t.tagName, t.standard(t.tagName)],
  attribute: [t.attributeName],
  meta: [t.meta],
};

const className = (group: string) => `nushu-syntax-${group}`;

const highlighter = syntaxHighlighting(tagHighlighter(
  Object.entries(syntaxTags).map(([group, tags]) => ({ tag: tags, class: className(group) })),
));

// Fence names (```yml) -> the language class added to each line of that code block
const languageAliases: Record<string, string> = {
  json: 'json', jsonc: 'json', json5: 'json',
  yaml: 'yaml', yml: 'yaml',
  ruby: 'ruby', rb: 'ruby',
  sh: 'shell', bash: 'shell', zsh: 'shell', shell: 'shell', shellscript: 'shell',
};

const languageClass = (language: string) => `nushu-lang-${language}`;
const shellVariableClass = 'nushu-shell-variable';
const shellVariable = /\$\{[^}]*\}|\$[A-Za-z_][A-Za-z0-9_]*|\$[0-9]/y;

// Returns the ranges of $NAME, ${...} and $1 expansions in a line of shell,
// skipping single-quoted strings and comments, where they aren't expanded.
function shellVariableRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  let quote: string | undefined;

  for (let i = 0; i < text.length; ++i) {
    const ch = text[i];
    if (quote === "'") {
      quote = ch === "'" ? undefined : quote;
      continue;
    }

    if (ch === '\\') {
      ++i;
    } else if (ch === '"') {
      quote = quote === '"' ? undefined : '"';
    } else if (quote === undefined && ch === "'") {
      quote = "'";
    } else if (quote === undefined && ch === '#' && (i === 0 || /\s/.test(text[i - 1]))) {
      break;
    } else if (ch === '$') {
      shellVariable.lastIndex = i;
      const match = shellVariable.exec(text);
      if (match) {
        ranges.push([i, i + match[0].length]);
        i += match[0].length - 1;
      }
    }
  }

  return ranges;
}

// Tags don't say which language they came from, so mark the lines of each fenced
// code block with its language. Only languages with their own colors are marked.
// Shell variables also get their own marks, since the highlighter gives them the
// same tag as assignments.
function languageDecorations(view: EditorView): DecorationSet {
  const lines = new RangeSetBuilder<Decoration>();
  const marks = new RangeSetBuilder<Decoration>();
  const variableMark = Decoration.mark({ class: shellVariableClass });
  const doc = view.state.doc;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: node => {
        if (node.name !== 'FencedCode') {
          return;
        }

        const info = node.node.getChild('CodeInfo');
        const name = info ? doc.sliceString(info.from, info.to).trim().split(/\s+/)[0].toLowerCase() : '';
        const language = languageAliases[name];
        if (language !== undefined) {
          const deco = Decoration.line({ class: languageClass(language) });
          const first = doc.lineAt(node.from).number;
          const start = Math.max(first, doc.lineAt(from).number);
          const end = Math.min(doc.lineAt(node.to).number, doc.lineAt(to).number);
          for (let number = start; number <= end; ++number) {
            const line = doc.line(number);
            lines.add(line.from, line.from, deco);

            const isFence = number === first || /^\s*(```|~~~)/.test(line.text);
            if (language === 'shell' && !isFence) {
              for (const [start, end] of shellVariableRanges(line.text)) {
                marks.add(line.from + start, line.from + end, variableMark);
              }
            }
          }
        }

        return false;
      },
    });
  }

  return RangeSet.join([lines.finish(), marks.finish()]);
}

const languagePlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = languageDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state)) {
      this.decorations = languageDecorations(update.view);
    }
  }
}, { decorations: plugin => plugin.decorations });

// Colors code inside fenced code blocks only, so markdown keeps its own styles
export function nushuSyntax(palette: Palette, options?: { dark: boolean }): Extension {
  const important = (color: string) => ({ color: `${color} !important` });
  const styles: Record<string, Record<string, string>> = Object.fromEntries(
    Object.entries(palette.syntax).map(([group, color]) => [
      `.cm-md-codeBlock .${className(group)}`,
      // MarkEdit's base theme italicizes comments and meta; Nushu doesn't
      { ...important(color), fontStyle: 'normal' },
    ]),
  );

  // Language-specific colors; the extra class outranks the rules above
  const json = `.cm-md-codeBlock.${languageClass('json')}`;
  const yaml = `.cm-md-codeBlock.${languageClass('yaml')}`;
  styles[`${json} .${className('property')}`] = important(palette.jsonKey);
  styles[`${yaml} .${className('key')}`] = important(palette.yamlKey);
  // The Ruby highlighter tags capitalized words (classes, modules, constants) as tags
  styles[`.cm-md-codeBlock.${languageClass('ruby')} .${className('tag')}`] = important(palette.rubyConstant);
  // Shell assignments (NAME=) share a tag with variables, so only the marked variables are gold
  const shell = `.cm-md-codeBlock.${languageClass('shell')}`;
  styles[`${shell} .${className('definition')}`] = important(palette.text);
  styles[`${shell} .${shellVariableClass}, ${shell} .${shellVariableClass} *`] = important(palette.shellVariable);

  return [highlighter, languagePlugin, EditorView.theme(styles, options)];
}
