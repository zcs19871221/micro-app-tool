import * as fs from 'fs';
import * as path from 'path';

type ReplaceBundleOpt = (
  | {
      readonly fileReplaceOverwirte: true;
      readonly fileReplaceDist?: never;
    }
  | {
      readonly fileReplaceDist: string;
      readonly fileReplaceOverwirte?: never;
    }
) & {
  readonly outputDir: string;
  readonly srcDirs: string[];
};

export default class ReplaceBundle {
  private chineseMappingKey: Record<string, string> = {};

  constructor(private readonly opt: ReplaceBundleOpt) {}
  async handleBundleReplace() {
    try {
      const { outputDir } = this.opt;
      const langLocate =
        outputDir[0].toUpperCase() +
        outputDir.slice(1, 3) +
        outputDir.slice(outputDir.indexOf('/'));

      const importTemplate = `import { lang } from '${langLocate}/lang/config';\n`;

      const chineseMappingKey = await replaceTextWithKey({
        srcs: targets,
        importTemplate,
        dist: test ? outputDir : null,
      });
      const langDir = path.join(outputDir, 'lang');

      if (!fs.existsSync(langDir)) {
        fs.mkdirSync(langDir);
      }

      const config = path.join(langDir, 'config.ts');

      if (!fs.existsSync(config)) {
        fs.writeFileSync(
          config,
          fs.readFileSync(path.join(__dirname, 'configTemplate.txt'))
        );
      }

      ['zh', 'en'].forEach((name) => {
        const languageJson = path.join(langDir, `${name}.json`);
        let keyMappingText: Record<string, string> = {};
        if (fs.existsSync(languageJson)) {
          keyMappingText = JSON.parse(fs.readFileSync(languageJson, 'utf-8'));
        }
        Object.keys(chineseMappingKey).forEach((chinese) => {
          let key = chineseMappingKey[chinese];
          if (name === 'eh') {
            const existsKeyMaybe = Object.entries(keyMappingText).find(
              ([, text]) => text === chinese
            )?.[0];
            if (existsKeyMaybe) {
              key = '';
              chineseMappingKey[chinese] = existsKeyMaybe;
            }
          }

          if (key) {
            keyMappingText[key] = chinese;
          }
        });

        fs.writeFileSync(languageJson, JSON.stringify(keyMappingText, null, 2));
      });
    } catch (error) {
      console.error(error);
    }
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
          const existsLangNaming = file.match(
            /((ctx\.lang)|(commonlang)|(lang))\./
          )?.[1];

          let pos = 0;
          const positionToReplace = [];
          const templateStack = [];
          const htmlStack = [];

          const pushPosition = (startPos, endPos, newText) => {
            const oldText = file.slice(startPos, endPos + 1);
            console.log(templateStack, htmlStack);
            console.log(`${startPos} - ${endPos} ${oldText} -> ${newText}`);
            positionToReplace.push({
              startPos,
              endPos,
              newText,
            });
          };

          const extractTemplateText = mixedTextExtractFactory({
            templateStartText: '`',
            templateEndText: '`',
            variableStartText: '${',
            variableEndText: '}',
            stack: templateStack,
            type: 'template',
          });
          const extractHtmlText = mixedTextExtractFactory({
            templateStartText: '>',
            templateStartConfirm: () => {
              const startTagRightBacket =
                file[pos - 1] === ' ' ||
                file[pos - 1] === ' \n' ||
                file[pos - 1].match(/[a-zA-Z\d]/) !== null;
              if (!startTagRightBacket) {
                return false;
              }
              let count = 50;
              if (startTagRightBacket) {
                let curPos = pos - 1;
                while (
                  count-- > 0 &&
                  inFileRange(curPos) &&
                  /[a-zA-Z\d]/.test(file[curPos])
                ) {
                  curPos--;
                }
                if (file.slice(curPos - 1, curPos + 1) === '</') {
                  return false;
                }
              }
              return true;
            },
            templateEndText: '</',
            variableStartText: '{',
            variableEndText: '}',
            stack: htmlStack,
            type: 'html',
          });

          while (inFileRange()) {
            handleComment();
            handleQuote();
            extractTemplateText();
            extractHtmlText();
            pos++;
          }

          generateLocaleJson();

          function generateLocaleJson() {
            if (positionToReplace.length === 0) {
              return;
            }
            positionToReplace.sort((a, b) => b.startPos - a.startPos);
            let prevStart = null;
            positionToReplace.forEach(({ startPos, endPos, newText }) => {
              if (!prevStart) {
                prevStart = startPos;
              } else if (endPos >= prevStart) {
                throw new Error(`error parse at${prevStart}`);
              }
              file = file.slice(0, startPos) + newText + file.slice(endPos + 1);
            });

            if (
              !existsLangNaming &&
              !file.match(/from ['"][^'"]+\/lang\/config/)
            ) {
              file = importTemplate + file;
            }

            const distDir = dist
              ? path.join(dist, path.basename(srcLocate))
              : srcLocate;

            fs.writeFileSync(distDir, file);
          }

          function handleQuote() {
            ["'", '"'].forEach((quote) => {
              if (matchText(quote)) {
                const startPos = pos;
                do {
                  pos++;
                } while (
                  inFileRange() &&
                  !matchText(quote) &&
                  file[pos - 1] !== '\\'
                );
                const chineseMaybe = file.slice(startPos + 1, pos);
                if (includesChinese(chineseMaybe)) {
                  let newText = setKeyIfNotExists(chineseMaybe);
                  if (isTsxAttributeString(file, startPos, pos + 1)) {
                    newText = `{${newText}}`;
                  }
                  pushPosition(startPos, pos, newText);
                }
              }
            });
          }

          function matchText(text) {
            return file.slice(pos, pos + text.length) === text;
          }

          function inFileRange(curPos = pos) {
            const ans = curPos < file.length && curPos >= 0;
            return ans;
          }

          function setKeyIfNotExists(text) {
            let textKey = '';
            if (chineseMappingKey[text]) {
              textKey = chineseMappingKey[text];
            } else {
              textKey = `${existsLangNaming ?? 'lang'}.key${key++}`;
              chineseMappingKey[text] = textKey;
            }

            return textKey;
          }

          // const {
          //   position: 'block'|'variable',
          //   type: 'template'|'html'
          //   startPos
          //   variables// block only
          // }

          const stack = [];
          const peek = () => stack[stack.length - 1];
          const matchTemplateStringBlockStart = () => {
            if ((matchText('`') && !peek()) || peek().position === 'variable') {
              return 'template';
            }
            return null;
          };
          const matchTemplateStringBlockEnd = () => {
            if (matchText('`') && peek()?.position === 'block') {
              if (peek()?.type !== 'template') {
                throw new Error('error matched block end');
              }
              return 'template';
            }
            return null;
          };

          const matchTemplateStringVariableStart = () => {
            if (
              matchText('${') &&
              peek()?.position === 'template' &&
              peek()?.type === 'template'
            ) {
              return 'template';
            }
            return null;
          };

          const matchTemplateStringVariableEnd = () => {
            if (matchText('}') && peek()?.position === 'variable') {
              if (peek()?.type !== 'template') {
                throw new Error('erro matched');
              }
              return 'template';
            }
            return null;
          };

          function mixedTextExtractFactory({
            stack,
            templateStartText,
            templateStartConfirm = () => true,
            templateEndText,
            variableStartText,
            variableEndText,
          }) {
            const peek = () => stack[stack.length - 1];
            const fixedTextExtract = () => {
              if (
                matchText(templateStartText) &&
                templateStartConfirm() &&
                (!peek() || peek().type === 'variable')
              ) {
                stack.push({
                  type: 'template',
                  variables: [],
                  startPos: pos,
                });
                return;
              }
              if (!stack.length) {
                return;
              }
              if (matchText(templateEndText) && peek()?.type === 'template') {
                const template = stack.pop();
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
                  endPos: pos,
                });
                chineseRangeMaybe.forEach((range) => {
                  const matchedChinese = file
                    .slice(range.startPos, range.endPos)
                    .match(
                      /[\p{Unified_Ideograph}\u3006\u3007][\ufe00-\ufe0f\u{e0100}-\u{e01ef}]?.*[\p{Unified_Ideograph}\u3006\u3007][\ufe00-\ufe0f\u{e0100}-\u{e01ef}]?/mu
                    );
                  if (matchedChinese) {
                    const startPos = range.startPos + matchedChinese.index;
                    const endPos = startPos + matchedChinese[0].length - 1;
                    pushPosition(
                      startPos,
                      endPos,
                      `${variableStartText}${setKeyIfNotExists(
                        matchedChinese[0]
                      )}${variableEndText}`
                    );
                  }
                });
                return;
              }

              if (matchText(variableStartText) && peek()?.type === 'template') {
                stack.push({
                  type: 'variable',
                  startPos: pos,
                });
              }

              if (matchText(variableEndText) && peek()?.type === 'variable') {
                const v = stack.pop();
                if (peek()?.type !== 'template') {
                  throw new Error('variable not in template string');
                }
                peek().variables.push({
                  startPos: v.startPos,
                  endPos: pos,
                });
              }
            };
            return fixedTextExtract;
          }

          function handleComment() {
            if (matchText('//')) {
              while (inFileRange() && !matchText('\n')) {
                pos++;
              }
            }
            if (matchText('/*')) {
              while (inFileRange() && !matchText('*/')) {
                pos++;
              }
            }
          }
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
