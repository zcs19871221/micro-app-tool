import { FileReplaceInfo, SyntaxParser } from './FileReplaceInfo';

export class CommentSyntaxParser implements SyntaxParser {
  private readonly startSymbol: string;
  private readonly endSymbol: string;

  constructor(private readonly type: 'line' | 'block') {
    this.startSymbol = type === 'line' ? '//' : '/*';
    this.endSymbol = type === 'line' ? '\n' : '*/';
  }

  public getStartSymbol() {
    return this.startSymbol;
  }

  public getEndSymbol() {
    return this.endSymbol;
  }

  match(fileReplacer: FileReplaceInfo) {
    return (
      fileReplacer.matchText(this.startSymbol) &&
      fileReplacer?.peek()?.position !== 'block'
    );
  }

  handle(fileReplacer: FileReplaceInfo) {
    const startPos = fileReplacer.pos;
    while (
      fileReplacer.inFileRange() &&
      !fileReplacer.matchText(this.endSymbol)
    ) {
      fileReplacer.pos++;
    }
    fileReplacer.checkAfterLoop(this, startPos);
    fileReplacer.debugMatched(startPos, this);
    fileReplacer.pos += this.endSymbol.length;
  }
  getName() {
    return this.type + 'Comment';
  }
}
