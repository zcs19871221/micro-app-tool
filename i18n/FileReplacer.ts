import { ReplaceBundle } from './ReplaceBundle';

interface SyntaxParser {
  match: () => boolean;
  handle: () => void;
  name: string;
}

interface Block {
  position: 'block';
  variables: {
    startPos: number;
    endPos: number;
  }[];
  startPos: number;
  type: 'templateString' | 'htmlTextNode';
}

interface Variable {
  position: 'variable';
  variables?: never;
  startPos: number;
  type: 'templateString' | 'htmlTextNode';
}
type StackItem = Block | Variable;

export class FileReplacer {
  private positionToReplace: {
    startPos: number;
    endPos: number;
    newText: string;
  }[] = [];

  public readonly stack: StackItem[] = [];

  public pos: number = 0;

  private pushPosition(startPos: number, endPos: number, newText: string) {
    const oldText = this.file.slice(startPos, endPos + 1);
    if (this.bundleReplacer.debug()) {
      console.log(this.stack);
      console.log(`${startPos} - ${endPos} ${oldText} -> ${newText}`);
    }
    this.positionToReplace.push({
      startPos,
      endPos,
      newText,
    });
  }

  private matchText(text: string, startPos = this.pos) {
    return this.file.slice(startPos, startPos + text.length) === text;
  }

  private prevStack(): null | StackItem {
    return this.stack[this.stack.length - 2] ?? null;
  }

  private peek(): null | StackItem {
    if (this.stack.length > 0) {
      return this.stack[this.stack.length - 1];
    }

    return null;
  }

  private inFileRange(curPos = this.pos) {
    const ans = curPos < this.file.length && curPos >= 0;
    return ans;
  }

  private stringVariableSyntaxParserFactory() {
    const types = ['singleQuote', 'doubleQuote'] as const;
    const stringVariableSyntaxParsers: SyntaxParser[] = types.map((name) => {
      const symobl = name === 'singleQuote' ? "'" : '"';

      const match = () => {
        return (
          this.matchText(symobl) &&
          !this.matchText('\\', this.pos - 1) &&
          this.peek()?.position !== 'block'
        );
      };
      const handle = () => {
        const startPos = this.pos;
        do {
          this.pos++;
        } while (
          this.inFileRange() &&
          !this.matchText(symobl) &&
          !this.matchText('\\', this.pos - 1)
        );
        const chineseMaybe = this.file.slice(startPos + 1, this.pos);
        if (this.includesChinese(chineseMaybe)) {
          let newText = this.bundleReplacer.getKeyOrSetIfAbsence(
            chineseMaybe,
            this.localeMapName
          );
          if (this.isTsxAttributeString(startPos, this.pos + 1)) {
            newText = `{${newText}}`;
          }
          this.pushPosition(startPos, this.pos, newText);
        }
      };

      return {
        name,
        match,
        handle,
      };
    });
    return stringVariableSyntaxParsers;
  }

  private isTsxAttributeString(startPos: number, endPos: number) {
    if (
      this.file[startPos - 1] === '=' &&
      this.file[startPos - 2].match(/[a-z\d]/i) &&
      [' ', '\n'].includes(this.file[endPos])
    ) {
      let count = 500;
      let finded = false;
      while (startPos-- > 0 && count-- >= 0) {
        if (
          this.file[startPos] === '<' &&
          this.file[startPos + 1].match(/[a-z]/i)
        ) {
          finded = true;
          break;
        }
      }
      if (!finded) {
        return false;
      }
      count = 500;
      while (endPos++ < this.file.length && count-- >= 0) {
        if (
          this.file[endPos] === '>' ||
          this.file.slice(endPos, endPos + 2) === '/>'
        ) {
          finded = true;
          break;
        }
      }
      return finded;
    }
    return false;
  }

  private includesChinese(text: string) {
    return /[\p{Unified_Ideograph}\u3006\u3007][\ufe00-\ufe0f\u{e0100}-\u{e01ef}]?/gmu.test(
      text
    );
  }

  private handleBlockStart(type: 'templateString' | 'htmlTextNode') {
    this.stack.push({
      type,
      position: 'block',
      variables: [],
      startPos: this.pos,
    });
  }

  private handleVarialbeStart(type: 'templateString' | 'htmlTextNode') {
    this.stack.push({
      type: 'templateString',
      position: 'variable',
      startPos: this.pos,
    });
  }

  private handleVarialbeEnd() {
    const variableStart = this.stack.pop() as Variable;

    const prev = this.peek() as Block;

    prev.variables.push({
      startPos: variableStart.startPos,
      endPos: this.pos,
    });
  }

  private handleBlockEnd(variableStartText: string, variableEndText: string) {
    const template = this.stack.pop() as Block;
    if (template.variables.length === 0) {
      return;
    }

    let start = template.startPos;
    const chineseRangeMaybe = [];
    template.variables.forEach((range) => {
      chineseRangeMaybe.push({
        startPos: start + 1,
        endPos: range.startPos,
      });
      start = range.endPos;
    });
    chineseRangeMaybe.push({
      startPos: start + 1,
      endPos: this.pos,
    });
    chineseRangeMaybe.forEach((range) => {
      const matchedChinese = this.file
        .slice(range.startPos, range.endPos)
        .match(
          /[\p{Unified_Ideograph}\u3006\u3007][\ufe00-\ufe0f\u{e0100}-\u{e01ef}]?.*[\p{Unified_Ideograph}\u3006\u3007][\ufe00-\ufe0f\u{e0100}-\u{e01ef}]?/mu
        );
      if (matchedChinese !== null) {
        const startPos = range.startPos + matchedChinese.index!;
        const endPos = startPos + matchedChinese[0].length - 1;
        this.pushPosition(
          startPos,
          endPos,
          `${variableStartText}${this.bundleReplacer.getKeyOrSetIfAbsence(
            matchedChinese[0],
            this.localeMapName
          )}${variableEndText}`
        );
      }
    });
  }

  private replacers: SyntaxParser[] = [
    ...this.stringVariableSyntaxParserFactory(),
    {
      name: 'lineComment',
      // `//` <div>//</div> 前面两个例子里的//算作字符串
      match: () => this.matchText('//') && this.peek()?.position !== 'block',
      handle: () => {
        while (this.inFileRange() && !this.matchText('\n')) {
          this.pos++;
        }
      },
    },
    {
      name: 'blockComment',
      // 同上
      match: () => this.matchText('//') && this.peek()?.position !== 'block',
      handle: () => {
        while (this.inFileRange() && !this.matchText('*/')) {
          this.pos++;
        }
      },
    },
    {
      name: 'templateStringBlockStart',
      // 同上
      match: () => {
        return this.matchText('`') && this.peek()?.position !== 'block';
      },
      handle: () => {
        this.handleBlockStart('templateString');
      },
    },
    {
      name: 'templateStringVariableStart',
      // 同上
      match: () => {
        return (
          this.matchText('${') &&
          !this.matchText('\\', this.pos - 1) &&
          this.peek()?.position === 'block' &&
          this.peek()?.type === 'templateString'
        );
      },
      handle: () => {
        this.handleVarialbeStart('templateString');
      },
    },
    {
      name: 'templateStringVariableEnd',
      // 同上
      match: () => {
        if (
          this.matchText('}') &&
          this.peek()?.type === 'templateString' &&
          this.peek()?.position === 'variable'
        ) {
          const prev = this.prevStack();
          if (prev?.position === 'block' && prev?.type === 'templateString') {
            return true;
          }
          throw new Error(
            'templateString start not capture correct, variableEnd at: ' +
              this.pos
          );
        }
        return false;
      },
      handle: () => {
        this.handleVarialbeEnd();
      },
    },
    {
      name: 'templateStringBlockEnd',
      // 同上
      match: () => {
        return (
          this.matchText('`') &&
          this.peek()?.type === 'templateString' &&
          this.peek()?.position === 'block'
        );
      },
      handle: () => {
        this.handleBlockEnd('${', '}');
      },
    },

    {
      name: 'htmlTextNodeBlockStart',
      // 同上
      match: () => {
        return (
          this.matchText('>') &&
          this.matchTagStart() &&
          (!this.peek() ||
            (this.peek()?.position === 'variable' &&
              this.peek()?.type === 'htmlTextNode'))
        );
      },
      handle: () => {
        this.handleBlockStart('htmlTextNode');
      },
    },
    {
      name: 'htmlTextNodeVariableStart',
      // 同上
      match: () => {
        return (
          this.matchText('{') &&
          this.peek()?.position === 'block' &&
          this.peek()?.type === 'htmlTextNode'
        );
      },
      handle: () => {
        this.handleVarialbeStart('htmlTextNode');
      },
    },
    {
      name: 'htmlTextNodeVariableEnd',
      // 同上
      match: () => {
        if (
          this.matchText('}') &&
          this.peek()?.type === 'htmlTextNode' &&
          this.peek()?.position === 'variable'
        ) {
          const prev = this.prevStack();
          if (prev?.position === 'block' && prev?.type === 'htmlTextNode') {
            return true;
          }
          throw new Error(
            'htmlTextNode start position not be captured correct, variableEnd at: ' +
              this.pos
          );
        }
        return false;
      },
      handle: () => {
        this.handleVarialbeEnd();
      },
    },
    {
      name: 'htmlTextNodeBlockEnd',
      // 同上
      match: () => {
        return (
          this.matchCloseTag('</') &&
          this.peek()?.type === 'htmlTextNode' &&
          this.peek()?.position === 'block'
        );
      },
      handle: () => {
        this.handleBlockEnd('{', '}');
      },
    },
  ];

  public replace(): string {
    while (this.inFileRange()) {
      const matchedReplacer = this.replacers.filter((replacer) =>
        replacer.match()
      );
      if (matchedReplacer.length > 1) {
        throw new Error(
          'matched replacer:' +
            matchedReplacer.map((r) => r.name) +
            ' at' +
            this.pos +
            'should only match one '
        );
      }
      if (matchedReplacer.length == 1) {
        matchedReplacer[0].handle();
      }
      this.pos++;
    }

    if (this.positionToReplace.length === 0) {
      return this.file;
    }

    this.positionToReplace.sort((a, b) => b.startPos - a.startPos);
    let prevStart: number | null = null;
    this.positionToReplace.forEach(({ startPos, endPos, newText }) => {
      if (prevStart === null) {
        prevStart = startPos;
      } else if (endPos >= prevStart) {
        throw new Error(`error parse at${prevStart}`);
      }
      this.file =
        this.file.slice(0, startPos) + newText + this.file.slice(endPos + 1);
    });

    return this.file;
  }

  public clear() {
    this.file = '';
    this.positionToReplace = [];
  }

  constructor(
    private file: string,
    private readonly bundleReplacer: ReplaceBundle,
    private readonly localeMapName: string
  ) {}
}
