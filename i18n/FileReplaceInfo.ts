import * as ts from 'typescript';
import {SyntaxKind} from 'typescript';

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
    public readonly generateKey: (chinese: string) => string,
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

    const handle = (node:ts.Node, handler = (textKey:string) => textKey) => {
      const chineseMaybe = node.getText();
          if (!this.includesChinese(node.getText())) {
            return ;
          }
          let textKey = this.generateKey(chineseMaybe);
          textKey = handler(textKey);
       
          this.positionToReplace.push({
            startPos: node.getStart(),
            endPos: node.getEnd(),
            newText: textKey,
          })
    }
      switch(node.kind) {
        case SyntaxKind.StringLiteral: {
          if (node.parent.kind === ts.SyntaxKind.ImportDeclaration) {
            return;
          }
          handle(node, (textKey:string) => {
            if (node.parent.kind === SyntaxKind.JsxAttribute) {
              return "{" +textKey + "}"
            }
            return textKey;
          })
        }
        break;
        case SyntaxKind.JsxText: {
          handle(node);

        }
        break;
        // case ts.SyntaxKind.TemplateHead: {
        //   console.log(node)
        // }
        // break;
        case ts.SyntaxKind.TemplateSpan: {
          console.log(node)

        }
        case ts.SyntaxKind.LastTemplateToken: {

        }
        break;
      }
      console.log(ts.SyntaxKind[node.kind], node.kind);
      console.log();
      ts.forEachChild(node, (n) => this.delintNode(n));
    }
}
