export interface SyntaxParser {
  match: (fileReplacer: FileReplaceInfo) => boolean;
  handle: (fileReplacer: FileReplaceInfo) => void;
  getName: () => string;
  getStartSymbol: () => string;
  getEndSymbol: () => string;
}

export interface Block {
  position: 'block';
  variables: {
    startPos: number;
    endPos: number;
  }[];
  startPos: number;
  type: 'templateString' | 'htmlTextNode';
}

export interface Variable {
  position: 'variable';
  variables?: never;
  startPos: number;
  type: 'templateString' | 'htmlTextNode';
}
export type StackItem = Block | Variable;

export class FileReplaceInfo {
  public positionToReplace: {
    startPos: number;
    endPos: number;
    newText: string;
  }[] = [];

  public readonly stack: StackItem[] = [];

  public pos: number = 0;

  public pushPosition(startPos: number, endPos: number, newText: string) {
    this.positionToReplace.push({
      startPos,
      endPos,
      newText,
    });
  }

  public checkAfterLoop(parser: SyntaxParser, starPos: number) {
    if (!this.inFileRange()) {
      throw new Error(
        parser.getName() +
          ' startPos: ' +
          starPos +
          ' endPos:' +
          this.pos +
          'not find correctly'
      );
    }
  }

  public static debugSeq: number = 1;

  public debugMatched(
    startPos: number,
    parser: SyntaxParser,
    endPos: number | null = this.pos
  ) {
    const startSymbolLength = parser.getStartSymbol().length;
    const endSymbolLength = parser.getEndSymbol().length;
    let message: string =
      FileReplaceInfo.debugSeq +
      ':' +
      parser.getName() +
      ' matched: ' +
      this.slice(startPos - this.debugPrev, startPos) +
      '[' +
      this.slice(startPos, startPos + startSymbolLength) +
      ']';
    let end = startPos + startSymbolLength;
    if (endPos !== null) {
      message +=
        this.slice(startPos + startSymbolLength, endPos) +
        '[' +
        this.slice(endPos, endPos + endSymbolLength) +
        ']';
      end = endPos + endSymbolLength;
    }
    message += this.slice(end, end + this.debugAfter);
    console.debug(message);
    console.debug('\n');
    FileReplaceInfo.debugSeq++;
  }

  public slice(startPos: number = this.pos, endPos: number = this.pos + 1) {
    return this.file.slice(startPos, endPos);
  }

  public matchText(text: string, startPos = this.pos) {
    return this.file.slice(startPos, startPos + text.length) === text;
  }

  public prevStack(): null | StackItem {
    return this.stack[this.stack.length - 2] ?? null;
  }

  public peek(): null | StackItem {
    if (this.stack.length > 0) {
      return this.stack[this.stack.length - 1];
    }

    return null;
  }

  public inFileRange(curPos = this.pos) {
    const ans = curPos < this.file.length && curPos >= 0;
    return ans;
  }

  public chineseReg() {
    return /[\u4e00-\u9fa5]+/g;
  }
  public includesChinese(text: string) {
    return this.chineseReg().test(text);
  }

  public clear() {
    this.file = '';
    this.positionToReplace = [];
  }

  constructor(
    public file: string,
    public fileName: string,
    public readonly generateKey: (chinese: string) => string,
    private readonly debugPrev = 8,
    private readonly debugAfter = 8
  ) {}
}
