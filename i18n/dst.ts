import { readFileSync } from "fs";
import * as ts from "typescript";

function delint(sourceFile: ts.SourceFile) {
  delintNode(sourceFile);
  // ts.SyntaxKind.StringLiteral done
  //   parent is attribute add {}
  //   parent is import skip
  //   others

  // ts.SyntaxKind.JsxText

  // ts.SyntaxKind.TemplateHead
  // ts.SyntaxKind.TemplateSpan
  // ts.SyntaxKind.LastTemplateToken
  function delintNode(node: ts.Node) {
    switch(node.kind) {
      case ts.SyntaxKind.StringLiteral: {
        const {pos,end} = node;
        if (node.parent.kind === ts.SyntaxKind.ImportDeclaration) {
          return;
        }
        let key = "lang.xx"
        let newText = key;
        if (node.parent.kind === ts.SyntaxKind.JsxAttribute) {
          newText =  "{" +key + "}"
        }
        // position.push({
        //   pos,
        //   end,
        //   newText
        // })
        console.log(node)
        
      }
      case ts.SyntaxKind.JsxText: {
        const {pos,end} = node;
       
      }
      case ts.SyntaxKind.TemplateHead: {

      }
      case ts.SyntaxKind.TemplateSpan: {

      }
      case ts.SyntaxKind.LastTemplateToken: {

      }
    }
    console.log(ts.SyntaxKind[node.kind],node.kind, node.getText())
    console.log()
    // switch (node.kind) {
    //   case ts.SyntaxKind.StringLiteral: {
    //     // console.log(node.getText())
    //   }
    //   case ts.SyntaxKind.TemplateExpression: {
    //     console.log(node.getText())
    //   }

    //   case ts.SyntaxKind.ForStatement:
    //   case ts.SyntaxKind.ForInStatement:
    //   case ts.SyntaxKind.WhileStatement:
     
    // }

    ts.forEachChild(node, delintNode);
  }

  // function report(node: ts.Node, message: string) {
  //   const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  //   console.log(`${sourceFile.fileName} (${line + 1},${character + 1}): ${message}`);
  // }
}


const fileNames = ["C:\\work\\command\\i18n\\test\\test.tsx"];
const file = readFileSync(fileNames[0], 'utf-8')
const sourceFile = ts.createSourceFile(
  fileNames[0],
  file,
  ts.ScriptTarget.ES2015,
   true
);


// delint it
delint(sourceFile);