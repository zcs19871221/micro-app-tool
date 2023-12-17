export interface SyntaxParser {
  match: (fileReplacer: FileReplaceInfo) => boolean;
  handle: (fileReplacer: FileReplaceInfo) => void;
  getName: () => string;
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
    const oldText = this.file.slice(startPos, endPos + 1);
    if (this.debug) {
      console.log(this.stack);
      console.log(`${startPos} - ${endPos} ${oldText} -> ${newText}`);
    }
    this.positionToReplace.push({
      startPos,
      endPos,
      newText,
    });
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

  public includesChinese(text: string) {
    return /[\p{Unified_Ideograph}\u3006\u3007][\ufe00-\ufe0f\u{e0100}-\u{e01ef}]?/gmu.test(
      text
    );
  }

  public clear() {
    this.file = '';
    this.positionToReplace = [];
  }

  constructor(
    public file: string,
    public fileName: string,
    public readonly generateKey: (chinese: string) => string,
    private readonly debug: boolean
  ) {}
}
