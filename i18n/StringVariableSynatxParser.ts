import { SyntaxParser, FileReplaceInfo } from './FileReplaceInfo';
export class StringVariableSyntaxParser implements SyntaxParser {
  private readonly symbol: string;

  constructor(private readonly name: 'singleQuote' | 'doubleQuote') {
    this.symbol = name === 'singleQuote' ? "'" : '"';
  }

  getStartSymbol() {
    return this.symbol;
  }

  getEndSymbol() {
    return this.symbol;
  }

  getName() {
    return this.name;
  }

  public match(replacer: FileReplaceInfo) {
    if (
      replacer.matchText(this.symbol) &&
      !replacer.matchText('\\', replacer.pos - 1) &&
      replacer.peek()?.position !== 'block'
    ) {
      return true;
    }
    return false;
  }

  public handle(replacer: FileReplaceInfo) {
    const startPos = replacer.pos;
    do {
      replacer.pos++;
    } while (
      replacer.inFileRange() &&
      (!replacer.matchText(this.symbol) ||
      replacer.matchText('\\', replacer.pos - 1))
    );
    if (replacer.slice(startPos - 5, startPos) == 'from ') {
      return;
    }
    replacer.checkAfterLoop(this, startPos);
    const chineseMaybe = replacer.file.slice(startPos + 1, replacer.pos);
    replacer.debugMatched(startPos, this, replacer.pos);
    if (replacer.includesChinese(chineseMaybe)) {
      let newText = replacer.generateKey(chineseMaybe);
      if (
        this.isTsxAttributeString(replacer.file, startPos, replacer.pos + 1)
      ) {
        newText = `{${newText}}`;
      }
      replacer.pushPosition(startPos, replacer.pos, newText);
    }
  }

  private isTsxAttributeString(file: string, startPos: number, endPos: number) {
    if (
      file[startPos - 1] === '=' &&
      file[startPos - 2].match(/[a-z\d]/i) &&
      [' ', '\n'].includes(file[endPos])
    ) {
      let count = 500;
      let finded = false;
      while (startPos-- > 0 && count-- >= 0) {
        if (file[startPos] === '<' && file[startPos + 1].match(/[a-z]/i)) {
          finded = true;
          break;
        }
      }
      if (!finded) {
        return false;
      }
      count = 500;
      while (endPos++ < file.length && count-- >= 0) {
        if (file[endPos] === '>' || file.slice(endPos, endPos + 2) === '/>') {
          finded = true;
          break;
        }
      }
      return finded;
    }
    return false;
  }
}
