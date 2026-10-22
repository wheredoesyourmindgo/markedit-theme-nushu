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
  css: 'css', scss: 'css', less: 'css',
};

const languageClass = (language: string) => `nushu-lang-${language}`;
const shellVariableClass = 'nushu-shell-variable';
const shellPunctuationClass = 'nushu-shell-variable-punctuation';
const shellCommandClass = 'nushu-shell-command';
const shellVariable = /\$\{[^}]*\}|\$[A-Za-z_][A-Za-z0-9_]*|\$[0-9?$@#*!-]/y;
// A run of word characters, stopping at whitespace, quotes, expansions and operators
const shellWord = /[^\s|&;()<>"'$`\\]+/y;
// Words that keep the next word in command position, or end it
const shellKeywordsBeforeCommand = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', 'time', '{', 'function']);
// VS Code colors declarations and control words like local and return as keywords, not commands
const shellKeywords = new Set([
  ...shellKeywordsBeforeCommand, 'fi', 'done', 'esac', '}', 'for', 'case', 'select', 'in',
  'local', 'declare', 'typeset', 'readonly', 'export', 'return', 'exit', 'break', 'continue',
]);

type ShellRange = [number, number, string];

// Returns the ranges of $NAME, ${...}, $1 and $? expansions in a line of shell, split into the $ { }
// punctuation and the name, and the command words (the first word of each command, which the
// highlighter only tags for builtins). Expansions are skipped in single-quoted strings and comments.
// This is a line-by-line guess, not a parser: commands aren't marked inside heredocs or on lines
// continued with a backslash.
function shellRanges(text: string, commandFirst: boolean): ShellRange[] {
  const ranges: ShellRange[] = [];
  let quote: string | undefined;
  let command = commandFirst;

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
      if (text[i + 1] === '(') {
        // $( starts a command; $(( starts arithmetic
        command = text[i + 2] !== '(';
        i += command ? 1 : 2;
        continue;
      }

      shellVariable.lastIndex = i;
      const match = shellVariable.exec(text);
      if (match) {
        const end = i + match[0].length;
        if (match[0].startsWith('${')) {
          ranges.push([i, i + 2, shellPunctuationClass], [i + 2, end - 1, shellVariableClass], [end - 1, end, shellPunctuationClass]);
        } else {
          ranges.push([i, i + 1, shellPunctuationClass], [i + 1, end, shellVariableClass]);
        }
        i = end - 1;
      }
      command = false;
    } else if (quote === undefined && /[|&;(]/.test(ch)) {
      // Redirects like >&2 and &> aren't command separators
      command = !(ch === '&' && (text[i - 1] === '>' || text[i - 1] === '<' || text[i + 1] === '>'));
    } else if (/\s/.test(ch)) {
      continue;
    } else if (quote === undefined || command) {
      shellWord.lastIndex = i;
      const match = shellWord.exec(text);
      if (!match) {
        command = false;
        continue;
      }

      const word = match[0];
      if (word === '{') {
        command = true;
      } else if (command && !word.includes('=') && /^[A-Za-z_./!]/.test(word)) {
        if (shellKeywords.has(word)) {
          command = shellKeywordsBeforeCommand.has(word);
        } else {
          ranges.push([i, i + word.length, shellCommandClass]);
          command = false;
        }
      } else {
        command = false;
      }
      i += word.length - 1;
    }
  }

  return ranges;
}

// Tags don't say which language they came from, so mark the lines of each fenced
// code block with its language. Only languages with their own colors are marked.
// Shell variables and commands also get their own marks, since the highlighter gives
// variables the same tag as assignments and doesn't tag most commands.
function languageDecorations(view: EditorView): DecorationSet {
  const lines = new RangeSetBuilder<Decoration>();
  const marks = new RangeSetBuilder<Decoration>();
  const shellMarks = Object.fromEntries(
    [shellVariableClass, shellPunctuationClass, shellCommandClass].map(name => [name, Decoration.mark({ class: name })]),
  );
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
          let heredoc: string | undefined;
          let continued = false;
          for (let number = start; number <= end; ++number) {
            const line = doc.line(number);
            lines.add(line.from, line.from, deco);

            const isFence = number === first || /^\s*(```|~~~)/.test(line.text);
            if (language === 'shell' && !isFence) {
              if (heredoc !== undefined && line.text.trim() === heredoc) {
                heredoc = undefined;
                continue;
              }

              const inHeredoc = heredoc !== undefined;
              for (const [start, end, name] of shellRanges(line.text, !inHeredoc && !continued)) {
                if (!inHeredoc || name !== shellCommandClass) {
                  marks.add(line.from + start, line.from + end, shellMarks[name]);
                }
              }

              heredoc ??= /(?<!<)<<(?!<)-?\s*['"]?([A-Za-z_]\w*)/.exec(line.text)?.[1];
              continued = line.text.endsWith('\\');
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
  // Shell assignments (NAME=) share a tag with variables, so color the marked variables instead
  const shell = `.cm-md-codeBlock.${languageClass('shell')}`;
  const shellMark = (name: string) => `${shell} .${name}, ${shell} .${name} *`;
  styles[`${shell} .${className('definition')}`] = important(palette.text);
  styles[shellMark(shellVariableClass)] = important(palette.shellVariable);
  styles[shellMark(shellPunctuationClass)] = important(palette.shellVariablePunctuation);
  // Builtins are tagged, other commands are marked; both match VS Code's shell commands
  styles[`${shell} .${className('builtin')}, ${shellMark(shellCommandClass)}`] = important(palette.shellCommand);
  // Element, class, pseudo-class and id selectors; the tags are shared with HTML and other languages
  const css = `.cm-md-codeBlock.${languageClass('css')}`;
  styles[['tag', 'class', 'label'].map(group => `${css} .${className(group)}`).join(', ')] = important(palette.cssSelector);

  return [highlighter, languagePlugin, EditorView.theme(styles, options)];
}
