import * as ts from 'typescript';
import { SyntaxKind, TemplateExpression } from 'typescript';

export class FileReplaceInfo {
  public positionToReplace: {
    startPos: number;
    endPos: number;
    newText: string;
  }[] = [];

  public pushPosition(startPos: number, endPos: number, newText: string) {
    this.positionToReplace.push({
      startPos,
      endPos,
      newText,
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
    // ts.SyntaxKind.StringLiteral done
    //   parent is attribute add {}
    //   parent is import skip
    //   others

    // ts.SyntaxKind.JsxText

    // ts.SyntaxKind.TemplateHead
    // ts.SyntaxKind.TemplateSpan
    // ts.SyntaxKind.LastTemplateToken

    const handle = (start:number, end:number, chineseMaybe:string, formatter = (textKey:string) => textKey) => {
      if (!this.includesChinese(chineseMaybe)) {
        return;
      }
      chineseMaybe.match(/^[\u4e00-\u9fa5a-zA-Z\d]+/)
      let textKey = this.generateKey(chineseMaybe);
      textKey = formatter(textKey);
      this.pushPosition(node.getStart(), node.getEnd(), textKey);
    }
    const collectStringLiteral = (node: ts.Node, handler = (textKey: string) => textKey) => {
      let chineseMaybe = node.getText();
      if (!this.includesChinese(node.getText())) {
        return;
      }
      chineseMaybe = chineseMaybe.replace(/['"]/g, '')
      let textKey = this.generateKey(chineseMaybe);
      textKey = handler(textKey);

      this.pushPosition(node.getStart(), node.getEnd(), textKey);
    };
    switch (node.kind) {
      case SyntaxKind.StringLiteral:
        {
          if (node.parent.kind === ts.SyntaxKind.ImportDeclaration) {
            return;
          }
          collectStringLiteral(node, (textKey: string) => {
            if (node.parent.kind === SyntaxKind.JsxAttribute) {
              return '{' + textKey + '}';
            }
            return textKey;
          });
        }
        break;
      case SyntaxKind.JsxText:
        collectStringLiteral(node, textKey => {
          return "{" + textKey + "}"
        });
        break;
      case ts.SyntaxKind.TemplateExpression: {
        const template = node as TemplateExpression;
        const literalTextNodes: {
          startPos: number;
          endPos: number;
          chineseMaybe: string;
        }[] = [
          {
            startPos: template.head.getStart(),
            endPos: template.head.getEnd(),
            chineseMaybe: template.head.rawText,
          },
        ];
        template.templateSpans.forEach((templateSpan) => {
          literalTextNodes.push({
            startPos: templateSpan.getStart(),
            chineseMaybe: templateSpan.literal.rawText,
            endPos: templateSpan.getEnd(),
          });
        });
        literalTextNodes.filter(l => {
          return this.includesChinese(l.chineseMaybe)
        }).forEach(l => {
          const textKey = this.generateKey(l.chineseMaybe);
          const startOffset = this.file.slice(l.startPos, l.endPos).indexOf(l.chineseMaybe);

          
          this.pushPosition(l.startPos + startOffset, l.startPos + startOffset + l.chineseMaybe.length, textKey)
     
        })
      }
    }
    ts.forEachChild(node, (n) => this.delintNode(n));
  }
}
