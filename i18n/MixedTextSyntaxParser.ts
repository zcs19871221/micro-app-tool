import { FileReplacer } from './FileReplacer';
class TemplateStartSynatxParser extends MixedTextSyntaxParser {
  match() {}

  handle() {
    return this.handleBlockStart();
  }
}

class MixedTextSyntaxParser {
  constructor(
    protected readonly fileReplacer: FileReplacer,
    private readonly type: 'templateString' | 'htmlTextNode'
  ) {}

  public handleBlockStart() {
    this.fileReplacer.stack.push({
      type: this.type,
      position: 'block',
      variables: [],
      startPos: this.fileReplacer.pos,
    });
  }

  private handleVarialbeStart() {
    this.fileReplacer.stack.push({
      type: this.type,
      position: 'variable',
      startPos: this.fileReplacer.pos,
    });
  }

  private handleVarialbeEnd() {
    const variableStart = this.fileReplacer.stack.pop() as Variable;

    const prev = this.fileReplacer.peek() as Block;

    prev.variables.push({
      startPos: variableStart.startPos,
      endPos: this.fileReplacer.pos,
    });
  }

  private handleBlockEnd(variableStartText: string, variableEndText: string) {
    const template = this.fileReplacer.stack.pop() as Block;
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
      endPos: this.fileReplacer.pos,
    });
    chineseRangeMaybe.forEach((range) => {
      const matchedChinese = this.fileReplacer.file
        .slice(range.startPos, range.endPos)
        .match(
          /[\p{Unified_Ideograph}\u3006\u3007][\ufe00-\ufe0f\u{e0100}-\u{e01ef}]?.*[\p{Unified_Ideograph}\u3006\u3007][\ufe00-\ufe0f\u{e0100}-\u{e01ef}]?/mu
        );
      if (matchedChinese !== null) {
        const startPos = range.startPos + matchedChinese.index!;
        const endPos = startPos + matchedChinese[0].length - 1;
        this.fileReplacer.pushPosition(
          startPos,
          endPos,
          `${variableStartText}${this.fileReplacer.bundleReplacer.getKeyOrSetIfAbsence(
            matchedChinese[0],
            this.fileReplacer.localeMapName
          )}${variableEndText}`
        );
      }
    });
  }
}
