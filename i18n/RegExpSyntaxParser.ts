import { FileReplaceInfo, SyntaxParser } from './FileReplaceInfo';

export class RegExpSyntaxParser implements SyntaxParser {
  private readonly startSymbol: string = '/';
  private readonly endSymbol: string = '/';

  public getStartSymbol() {
    return this.startSymbol;
  }

  public getEndSymbol() {
    return this.endSymbol;
  }

  match(fileReplacer: FileReplaceInfo) {
    if (
      fileReplacer.matchText(this.startSymbol) &&
      fileReplacer?.peek()?.position !== 'block'
    ) {
      return /[^/<\\]\/[^*>/]/.test(
        fileReplacer.slice(fileReplacer.pos - 1, fileReplacer.pos + 2)
      );
    }
    return false;
  }

  handle(fileReplacer: FileReplaceInfo) {
    let pos = fileReplacer.pos;
    let count = 50;
    let isReg = false;
    while (count-- > 0 && fileReplacer.inFileRange(pos)) {
      pos++;
      if (fileReplacer.file[pos] === this.endSymbol) {
        if (/[^/<\\]\/[^*>/]/.test(
          fileReplacer.slice(pos - 1, pos + 2)
        )) {
          isReg = true;
          break;
        }
      }
    }
 
    if (isReg) {
      fileReplacer.debugMatched(fileReplacer.pos, this, pos);
      fileReplacer.pos = pos;
    }
 
  }

  getName() {
    return 'RegMatched';
  }
}
