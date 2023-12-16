/* eslint-disable max-classes-per-file */

import * as fs from 'fs';
import * as path from 'path';

class MixedTextExtractor {
  stack = [];

  templateStartText;

  templateEndText;

  variableStartText;

  variableEndText;

  constructor({
    templateStartText,
    templateEndText,
    variableStartText,
    variableEndText,
    fileReplacer,
  }) {
    this.templateStartText = templateStartText;
    this.templateEndText = templateEndText;
    this.variableStartText = variableStartText;
    this.variableEndText = variableEndText;
    this.fileReplacer = fileReplacer;
  }

  peek() {
    return this.stack[this.stack.length - 1];
  }

  // eslint-disable-next-line class-methods-use-this
  templateStartConfirm() {
    return true;
  }

  extract() {
    if (
      this.fileReplacer.matchText(this.templateStartText) &&
      this.templateStartConfirm() &&
      (!this.peek() || this.peek().type === 'variable')
    ) {
      this.stack.push({
        type: 'template',
        variables: [],
        startPos: this.fileReplacer.pos,
      });
      return;
    }
    if (!this.stack.length) {
      return;
    }
    if (
      this.fileReplacer.matchTextmatchText(this.templateEndText) &&
      this.peek()?.type === 'template'
    ) {
      const template = this.stack.pop();
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
        if (matchedChinese) {
          const startPos = range.startPos + matchedChinese.index;
          const endPos = startPos + matchedChinese[0].length - 1;
          this.fileReplacer.pushPosition(
            startPos,
            endPos,
            `${this.variableStartText}${this.fileReplacer.setKeyIfNotExists(
              matchedChinese[0]
            )}${this.variableEndText}`
          );
        }
      });
      return;
    }

    if (
      this.fileReplacer.matchText(this.variableStartText) &&
      this.peek()?.type === 'template'
    ) {
      this.tack.push({
        type: 'variable',
        startPos: this.fileReplacer.pos,
      });
    }

    if (
      this.fileReplacer.matchText(this.variableEndText) &&
      this.peek()?.type === 'variable'
    ) {
      const v = this.stack.pop();
      if (this.peek()?.type !== 'template') {
        throw new Error('variable not in template string');
      }
      this.peek().variables.push({
        startPos: v.startPos,
        endPos: this.fileReplacer.pos,
      });
    }
  }
}

class TemplateExtractor extends MixedTextExtractor {
  constructor(fileReplacer) {
    super({
      templateStartText: '`',
      templateEndText: '`',
      variableStartText: '${',
      variableEndText: '}',
      fileReplacer,
    });
  }
}
class HtmlTextNodeExtractor extends MixedTextExtractor {
  constructor(fileReplacer) {
    super({
      templateStartText: '>',
      templateEndText: '</',
      variableStartText: '{',
      variableEndText: '}',
      fileReplacer,
    });
  }

  templateStartConfirm() {
    const { file, pos } = this.fileReplacer;
    const startTagRightBacket =
      file[pos - 1] === ' ' ||
      file[pos - 1] === ' \n' ||
      file[pos - 1].match(/[a-zA-Z\d]/) !== null;
    let count = 50;
    if (startTagRightBacket) {
      let curPos = pos - 1;
      while (
        count-- > 0 &&
        this.fileReplacer.inFileRange(curPos) &&
        /[a-zA-Z\d]/.test(file[curPos])
      ) {
        curPos--;
      }
      if (file.slice(curPos - 1, curPos + 1) === '</') {
        return false;
      }
    }
    return true;
  }
}

class FileReplacer {
  pos = 0;

  positionToReplace = [];

  templateStack = [];

  htmlStack = [];

  file = '';

  existsLangNaming = '';

  static chineseMappingKey = {};

  static key = 1;

  constructor({ file, srcLocate }) {
    this.file = file;
    this.existsLangNaming = file.match(
      /((ctx\.lang)|(commonlang)|(lang))\./
    )?.[1];
    this.templateTextExtractor = new TemplateExtractor();
    this.htmlTextExtractor = new HtmlTextNodeExtractor();
    this.srcLocate = srcLocate;
  }

  replace() {
    while (this.inFileRange()) {
      this.handleComment();
      this.handleQuote();
      this.extractTemplateText();
      this.extractHtmlText();
      this.pos++;
    }

    this.generateLocaleJson();
  }

  handleQuote() {
    ["'", '"'].forEach((quote) => {
      if (this.matchText(quote)) {
        const startPos = this.pos;
        do {
          this.pos++;
        } while (
          this.inFileRange() &&
          !this.matchText(quote) &&
          this.file[this.pos - 1] !== '\\'
        );
        const chineseMaybe = this.file.slice(startPos + 1, this.pos);
        if (includesChinese(chineseMaybe)) {
          let newText = this.setKeyIfNotExists(chineseMaybe);
          if (isTsxAttributeString(this.file, startPos, this.pos + 1)) {
            newText = `{${newText}}`;
          }
          this.pushPosition(startPos, this.pos, newText);
        }
      }
    });
  }

  handleComment() {
    if (this.matchText('//')) {
      while (this.inFileRange() && !this.matchText('\n')) {
        this.pos++;
      }
    }
    if (this.matchText('/*')) {
      while (this.inFileRange() && !this.matchText('*/')) {
        this.pos++;
      }
    }
  }

  pushPosition(startPos, endPos, newText) {
    const oldText = this.file.slice(startPos, endPos + 1);
    console.log(this.templateStack, this.htmlStack);
    console.log(`${startPos} - ${endPos} ${oldText} -> ${newText}`);
    this.positionToReplace.push({
      startPos,
      endPos,
      newText,
    });
  }

  matchText(text) {
    return this.file.slice(this.pos, this.pos + text.length) === text;
  }

  inFileRange(curPos = this.pos) {
    const ans = curPos < this.file.length && curPos >= 0;
    return ans;
  }

  setKeyIfNotExists(text) {
    let textKey = '';
    if (FileReplacer.chineseMappingKey[text]) {
      textKey = FileReplacer.chineseMappingKey[text];
    } else {
      textKey = `${this.existsLangNaming ?? 'lang'}.key${FileReplacer.key++}`;
      FileReplacer.chineseMappingKey[text] = textKey;
    }

    return textKey;
  }

  generateLocaleJson() {
    if (this.positionToReplace.length === 0) {
      return;
    }
    this.positionToReplace.sort((a, b) => b.startPos - a.startPos);
    let prevStart = null;
    this.positionToReplace.forEach(({ startPos, endPos, newText }) => {
      if (!prevStart) {
        prevStart = startPos;
      } else if (endPos >= prevStart) {
        throw new Error(`error parse at${prevStart}`);
      }
      this.file =
        this.file.slice(0, startPos) + newText + this.file.slice(endPos + 1);
    });

    if (
      !this.existsLangNaming &&
      !this.file.match(/from ['"][^'"]+\/lang\/config/)
    ) {
      this.file = this.importTemplate + this.file;
    }

    const distDir = this.dist
      ? path.join(this.dist, path.basename(this.srcLocate))
      : this.srcLocate;

    fs.writeFileSync(distDir, this.file);
  }
}
export const replaceTextWithKey = async ({
  debug,
  srcs,
  chineseMappingKey = {},
  importTemplate,
  key = 1,
  dist,
}) => {
  await Promise.all(
    srcs
      .filter((fileName) => filter(fileName))
      .map((srcLocate) => {
        if (fs.lstatSync(srcLocate).isDirectory()) {
          return replaceTextWithKey({
            debug,
            srcs: fs.readdirSync(srcLocate).map((d) => path.join(srcLocate, d)),
            chineseMappingKey,
            key,
            importTemplate,
            dist,
          });
        }

        return fs.promises.readFile(srcLocate, 'utf-8').then((file) => {
          const fileReplacer = new FileReplacer({ file, srcLocate });
          return fileReplacer.replace();
        });
      })
  );
  return chineseMappingKey;
};

function filter(name) {
  if (name.startsWith('.')) {
    return false;
  }

  if (name.includes('node_modules')) {
    return false;
  }

  if (name.match(/\..*$/) && !name.match(/\.([jt]sx?)$/)) {
    return false;
  }

  if (
    [
      'operationsOverview',
      'groupOverview',
      'lifeCycleOverview',
      'energyOverview',
      'energyEfficiency',
    ].includes(name)
  ) {
    return false;
  }

  return true;
}

function includesChinese(text) {
  return /[\p{Unified_Ideograph}\u3006\u3007][\ufe00-\ufe0f\u{e0100}-\u{e01ef}]?/gmu.test(
    text
  );
}
function isTsxAttributeString(file, matchedStart, matchedEnd) {
  if (
    file[matchedStart - 1] === '=' &&
    file[matchedStart - 2].match(/[a-z\d]/i) &&
    [' ', '\n'].includes(file[matchedEnd])
  ) {
    let count = 500;
    let finded = false;
    while (matchedStart-- > 0 && count-- >= 0) {
      if (
        file[matchedStart] === '<' &&
        file[matchedStart + 1].match(/[a-z]/i)
      ) {
        finded = true;
        break;
      }
    }
    if (!finded) {
      return false;
    }
    count = 500;
    while (matchedEnd++ < file.length && count-- >= 0) {
      if (
        file[matchedEnd] === '>' ||
        file.slice(matchedEnd, matchedEnd + 2) === '/>'
      ) {
        finded = true;
        break;
      }
    }
    return finded;
  }
  return false;
}
