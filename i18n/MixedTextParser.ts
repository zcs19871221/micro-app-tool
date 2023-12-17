import {
  Block,
  FileReplaceInfo,
  SyntaxParser,
  Variable,
} from './FileReplaceInfo';

abstract class SyntaxParserImpl implements SyntaxParser {
  constructor(private readonly name: string, private readonly symobl: string) {}

  public match(fileReplacer: FileReplaceInfo): boolean {
    if (fileReplacer.matchText(this.symobl)) {
      return this.doMatch(fileReplacer);
    }

    return false;
  }

  public handle(fileReplacer: FileReplaceInfo) {
    this.doHandle(fileReplacer);
  }

  protected abstract doMatch(fileReplacer: FileReplaceInfo): boolean;
  protected abstract doHandle(fileReplacer: FileReplaceInfo): void;

  public getName() {
    return this.name;
  }
}
interface Matcher {
  match(replacer: FileReplaceInfo): boolean;
}
class TempalteStingVariableStartMatcher implements Matcher {
  match(replacer: FileReplaceInfo): boolean {
    return !replacer.matchText('\\', replacer.pos - 1);
  }
}
class HtmlTextNodeBlockStartMatcher implements Matcher {
  private matchTextNodeBlockStartTag(replacer: FileReplaceInfo) {
    const { file, pos } = replacer;
    const startTagRightBacket = file[pos - 1].match(/[a-zA-Z\d\s\n}]/) !== null;
    if (!startTagRightBacket) {
      return false;
    }
    let curPos = pos;
    let searchCount = 150;
    do {
      curPos--;
    } while (
      replacer.inFileRange(curPos) &&
      replacer.file[curPos] !== '<' &&
      searchCount-- > 0
    );
    if (file[curPos] !== '<' || file[curPos + 1] === '/') {
      return false;
    }
    const tag = file
      .slice(curPos + 1, pos)
      .match(/(([a-z]+(\d+)?)|([A-Z][a-zA-Z]+))[\s\n]+/);
    if (tag) {
      return true;
    }

    return false;
  }

  public match(replacer: FileReplaceInfo) {
    return (
      this.matchTextNodeBlockStartTag(replacer) &&
      replacer.peek()?.type === 'htmlTextNode'
    );
  }
}

abstract class MixedTextParser extends SyntaxParserImpl {
  constructor(
    protected readonly type: 'templateString' | 'htmlTextNode',
    protected readonly position:
      | 'BlockStart'
      | 'BlockEnd'
      | 'VariableStart'
      | 'VariableEnd',
    symobl: string
  ) {
    super(type + position, symobl);
  }

  protected doMatch(replacer: FileReplaceInfo): boolean {
    if (
      this.type === 'htmlTextNode' &&
      replacer.fileName.match(/\.[tj]sx$/) === null
    ) {
      return false;
    }
    return this.doMatchMixedText(replacer);
  }

  protected abstract doMatchMixedText(replacer: FileReplaceInfo): boolean;
}

export class BlockStart extends MixedTextParser {
  private matcher: Matcher = {
    match: () => true,
  };
  constructor(
    protected readonly type: 'templateString' | 'htmlTextNode',
    symobl: string
  ) {
    super(type, 'BlockStart', symobl);
    if (type === 'templateString') {
      this.matcher = new HtmlTextNodeBlockStartMatcher();
    }
  }

  protected doMatchMixedText(replacer: FileReplaceInfo): boolean {
    return (
      !replacer.peek() ||
      (replacer.peek()?.position === 'variable' && this.matcher.match(replacer))
    );
  }

  protected doHandle(replacer: FileReplaceInfo) {
    replacer.stack.push({
      type: this.type,
      position: 'block',
      variables: [],
      startPos: replacer.pos,
    });
  }
}

export class VariableStart extends MixedTextParser {
  constructor(
    protected readonly type: 'templateString' | 'htmlTextNode',
    symobl: string
  ) {
    super(type, 'VariableStart', symobl);
    if (type === 'htmlTextNode') {
      this.matcher = new TempalteStingVariableStartMatcher();
    }
  }

  private matcher: Matcher = { match: () => true };

  protected doMatchMixedText(replacer: FileReplaceInfo): boolean {
    if (
      this.type === 'templateString' &&
      replacer.matchText('\\', replacer.pos - 1)
    ) {
      return false;
    }
    return (
      replacer.peek()?.position === 'block' &&
      replacer.peek()?.type === this.type &&
      this.matcher.match(replacer)
    );
  }

  protected doHandle(replacer: FileReplaceInfo) {
    replacer.stack.push({
      type: this.type,
      position: 'variable',
      startPos: replacer.pos,
    });
  }
}

export class VariableEnd extends MixedTextParser {
  constructor(
    protected readonly type: 'templateString' | 'htmlTextNode',
    symobl: string
  ) {
    super(type, 'VariableEnd', symobl);
  }

  protected doMatchMixedText(replacer: FileReplaceInfo): boolean {
    if (
      replacer.peek()?.type === this.type &&
      replacer.peek()?.position === 'variable'
    ) {
      const prev = replacer.prevStack();
      if (prev?.position === 'block' && prev?.type === this.type) {
        return true;
      }
      throw new Error('VariableEnd at: ' + replacer.pos);
    }
    return false;
  }

  protected doHandle(replacer: FileReplaceInfo) {
    const variableStart = replacer.stack.pop() as Variable;

    const prev = replacer.peek() as Block;
    prev.variables.push({
      startPos: variableStart.startPos,
      endPos: replacer.pos,
    });
  }
}

export class BlockEnd extends MixedTextParser {
  constructor(
    protected readonly type: 'templateString' | 'htmlTextNode',
    symobl: string,
    private readonly variableStartSymbol: string,
    private readonly variableEndSymbol: string
  ) {
    super(type, 'BlockEnd', symobl);
  }

  protected doMatchMixedText(replacer: FileReplaceInfo): boolean {
    return (
      replacer.peek()?.type === this.type &&
      replacer.peek()?.position === 'block'
    );
  }

  protected doHandle(replacer: FileReplaceInfo) {
    const template = replacer.stack.pop() as Block;
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
      endPos: replacer.pos,
    });
    chineseRangeMaybe.forEach((range) => {
      const matchedChinese = replacer.file
        .slice(range.startPos, range.endPos)
        .match(
          /[\p{Unified_Ideograph}\u3006\u3007][\ufe00-\ufe0f\u{e0100}-\u{e01ef}]?.*[\p{Unified_Ideograph}\u3006\u3007][\ufe00-\ufe0f\u{e0100}-\u{e01ef}]?/mu
        );
      if (matchedChinese !== null) {
        const startPos = range.startPos + matchedChinese.index!;
        const endPos = startPos + matchedChinese[0].length - 1;
        replacer.pushPosition(
          startPos,
          endPos,
          `${
            this.variableStartSymbol
          }${this.bundleReplacer.getKeyOrSetIfAbsence(
            matchedChinese[0],
            this.localeMapName
          )}${this.variableEndSymbol}`
        );
      }
    });
  }
}
