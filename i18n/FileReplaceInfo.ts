import * as ts from 'typescript';
import { SyntaxKind, TemplateExpression } from 'typescript';

export class FileReplaceInfo {
  public positionToReplace: {
    startPos: number;
    endPos: number;
    newText: string;
  }[] = [];

  public pushPositionIfChinese({
    start,
    end,
    chineseMaybe,
    needTrim,
    formatter = (textKey: string) => textKey,
  }: {
    start: number;
    end: number;
    needTrim: boolean;
    chineseMaybe: string;
    formatter?: (textKey: string) => string;
  }) {
    if (!this.includesChinese(chineseMaybe)) {
      return;
    }
    if (needTrim) {
      const needTrimStart = chineseMaybe.match(/^[^\u4e00-\u9fa5a-zA-Z\d]+/);
      const needTrimEnd = chineseMaybe.match(/[^\u4e00-\u9fa5a-zA-Z\d]+$/);
      if (needTrimStart !== null) {
        chineseMaybe = chineseMaybe.slice(needTrimStart[0].length);
        start = start + needTrimStart[0].length;
      }
      if (needTrimEnd !== null) {
        chineseMaybe = chineseMaybe.slice(
          0,
          chineseMaybe.length - needTrimEnd[0].length
        );
        end = end - needTrimEnd[0].length;
      }
    }

    let textKey = this.generateKey(chineseMaybe);
    textKey = formatter(textKey);

    this.positionToReplace.push({
      startPos: start,
      endPos: end,
      newText: textKey,
    });
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
    public readonly generateKey: (chinese: string) => string
  ) {}

  public parse() {
    const sourceFile = ts.createSourceFile(
      this.fileName,
      this.file,
      ts.ScriptTarget.ES2015,
      true
    );
    this.delintNode(sourceFile);
  }

  private delintNode(node: ts.Node) {
    switch (node.kind) {
      case SyntaxKind.StringLiteral:
        {
          if (node.parent.kind === ts.SyntaxKind.ImportDeclaration) {
            return;
          }
          this.pushPositionIfChinese({
            start: node.getStart(),
            end: node.getEnd(),
            chineseMaybe: node.getText().replace(/(^['"])|(['"]$)/g, ''),
            formatter(textKey: string) {
              if (node.parent.kind === SyntaxKind.JsxAttribute) {
                return '{' + textKey + '}';
              }
              return textKey;
            },
            needTrim: false,
          });
        }
        break;
      case SyntaxKind.JsxText:
        this.pushPositionIfChinese({
          start: node.getStart(),
          end: node.getEnd(),
          chineseMaybe: node.getText(),
          formatter(textKey: string) {
            return '{' + textKey + '}';
          },
          needTrim: true,
        });
        break;
      case ts.SyntaxKind.TemplateExpression: {
        const template = node as TemplateExpression;
        const literalTextNodes: {
          start: number;
          end: number;
          chineseMaybe: string;
        }[] = [
          {
            start: template.head.getStart(),
            end: template.head.getEnd(),
            chineseMaybe: template.head.rawText,
          },
        ];

        template.templateSpans.forEach((templateSpan) => {
          literalTextNodes.push({
            start: templateSpan.getStart(),
            chineseMaybe: templateSpan.literal.rawText,
            end: templateSpan.getEnd(),
          });
        });

        literalTextNodes.forEach((l) => {
          const startOffset = this.file
            .slice(l.start, l.end)
            .indexOf(l.chineseMaybe);

          this.pushPositionIfChinese({
            start: l.start + startOffset,
            end: l.start + startOffset + l.chineseMaybe.length,
            chineseMaybe: l.chineseMaybe,
            needTrim: true,
            formatter(textKey: string) {
              return '${' + textKey + '}';
            },
          });
        });
      }
    }
    ts.forEachChild(node, (n) => this.delintNode(n));
  }
}
