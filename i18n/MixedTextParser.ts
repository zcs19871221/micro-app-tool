import {
  Block,
  FileReplaceInfo,
  SyntaxParser,
  Variable,
} from './FileReplaceInfo';

abstract class SyntaxParserImpl implements SyntaxParser {
  constructor(
    private readonly name: string,
    private readonly startSymbol: string,
    private readonly endSymobl: string,
    private readonly symoblToMatch: string
  ) {}

  getStartSymbol() {
    return this.startSymbol;
  }
  getEndSymbol() {
    return this.endSymobl;
  }

  public match(fileReplacer: FileReplaceInfo): boolean {
    if (fileReplacer.matchText(this.symoblToMatch)) {
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
class TemplateStringEscapeMatch implements Matcher {
  match(replacer: FileReplaceInfo): boolean {
    return !replacer.matchText('\\', replacer.pos - 1);
  }
}
class HtmlTextNodeBlockStartMatcher implements Matcher {
  public match(replacer: FileReplaceInfo) {
    const { file, pos } = replacer;
    const startTagRightBacket =
      file[pos - 1].match(/[a-zA-Z\d\s\n}"']/) !== null;
    if (!startTagRightBacket) {
      return false;
    }
    let curPos = pos;
    let searchCount = 250;
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
    const matchedTag = file
      .slice(curPos + 1, pos)
      .match(/((?:(?:[a-z]+(\d+)?)|(?:[A-Z][a-zA-Z]+)))([\s\n]+)?/);
    if (matchedTag) {
      const tagMaybe = matchedTag[1];
      if (matchedTag[2]) {
        return true;
      }
      return file.indexOf('</' + tagMaybe + '>', pos) > -1;
    }

    return false;
  }
}

abstract class MixedTextParser extends SyntaxParserImpl {
  constructor(
    protected readonly type: 'templateString' | 'htmlTextNode',
    protected readonly position:
      | 'BlockStart'
      | 'BlockEnd'
      | 'VariableStart'
      | 'VariableEnd'
  ) {
    let startBlockSymbol = '`';
    let endBlockSymbol = '`';
    let startVariableSymbol = '${';
    let endVariableSymbol = '}';
    let symoblToMatch = '';
    if (type === 'htmlTextNode') {
      startBlockSymbol = '>';
      endBlockSymbol = '</';
      startVariableSymbol = '{';
      endVariableSymbol = '}';
    }
    let startSymbol;
    let endSymbol;
    if (position === 'BlockEnd' || position === 'BlockStart') {
      startSymbol = startBlockSymbol;
      endSymbol = endBlockSymbol;
    } else {
      startSymbol = startVariableSymbol;
      endSymbol = endVariableSymbol;
    }
    if (position === 'BlockStart' || position === 'VariableStart') {
      symoblToMatch = startSymbol;
    } else {
      symoblToMatch = endSymbol;
    }
    super(type + position, startSymbol, endSymbol, symoblToMatch);
  }

  protected matcher: Matcher = {
    match: () => true,
  };

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
  constructor(protected readonly type: 'templateString' | 'htmlTextNode') {
    super(type, 'BlockStart');
    if (type === 'htmlTextNode') {
      this.matcher = new HtmlTextNodeBlockStartMatcher();
    }
  }

  protected doMatchMixedText(replacer: FileReplaceInfo): boolean {
    return (
      (!replacer.peek() || replacer.peek()?.position === 'variable') &&
      this.matcher.match(replacer)
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
  constructor(protected readonly type: 'templateString' | 'htmlTextNode') {
    super(type, 'VariableStart');
    if (type === 'templateString') {
      this.matcher = new TemplateStringEscapeMatch();
    }
  }

  protected doMatchMixedText(replacer: FileReplaceInfo): boolean {
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
  constructor(protected readonly type: 'templateString' | 'htmlTextNode') {
    super(type, 'VariableEnd');
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
    replacer.debugMatched(variableStart.startPos, this);
    prev.variables.push({
      startPos: variableStart.startPos,
      endPos: replacer.pos,
    });
  }
}

export class BlockEnd extends MixedTextParser {
  constructor(
    protected readonly type: 'templateString' | 'htmlTextNode',
    private readonly variableStartSymbol: string,
    private readonly variableEndSymbol: string
  ) {
    super(type, 'BlockEnd');
    if (type === 'templateString') {
      this.matcher = new TemplateStringEscapeMatch();
    }
  }

  protected doMatchMixedText(replacer: FileReplaceInfo): boolean {
    return (
      replacer.peek()?.type === this.type &&
      replacer.peek()?.position === 'block' &&
      this.matcher.match(replacer)
    );
  }

  protected doHandle(replacer: FileReplaceInfo) {
    const template = replacer.stack.pop() as Block;
    let start = template.startPos;

    replacer.debugMatched(start, this);

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
      const chineseMaybe = replacer.file.slice(range.startPos, range.endPos);
      const chineseReg = replacer.chineseReg();
      let matchedChinese: RegExpExecArray | null = null;
      while ((matchedChinese = chineseReg.exec(chineseMaybe))) {
        if (matchedChinese !== null) {
          const startPos = range.startPos + matchedChinese.index;
          const endPos = startPos + matchedChinese[0].length - 1;
          replacer.pushPosition(
            startPos,
            endPos,
            `${this.variableStartSymbol}${replacer.generateKey(
              matchedChinese[0]
            )}${this.variableEndSymbol}`
          );
        }
      }
    });
  }
}
