import * as fs from 'fs-extra';
import * as path from 'path';
import { FileReplaceInfo, SyntaxParser } from './FileReplaceInfo';
import {
  BlockEnd,
  BlockStart,
  VariableEnd,
  VariableStart,
} from './MixedTextParser';
import { StringVariableSyntaxParser } from './StringVariableSynatxParser';
import { CommentSyntaxParser } from './CommentSyntaxParser';

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
  readonly ouputImportPath: string;
  readonly srcTargets: string[];
  debug?: boolean;
};

export class ReplaceBundle {
  private chineseMappingKey: Record<string, string>;

  private key: number = 1;

  private readonly langDir: string;

  private static locales: string[] = ['zh.json', 'en.json'];

  private static configFile: string = 'config.ts';

  private static templateConfigFile = `import zh from './zh.json';
import en from './en.json';

export const lang = window.hi_system.switchLang(
  {
    zh,
    en,
  },
  'zh-cn'
);
`;

  constructor(private readonly opt: ReplaceBundleOpt) {
    const { outputDir, fileReplaceDist, debug } = this.opt;

    this.langDir = path.join(outputDir, 'lang');

    fs.ensureDirSync(this.langDir);
    const keyMappingText =
      fs.readJSONSync(path.join(this.langDir, ReplaceBundle.locales[0]), {
        throws: false,
      }) ?? {};
    this.chineseMappingKey = Object.entries<string>(keyMappingText).reduce(
      (chineseMappingKey: Record<string, string>, [key, chinese]) => {
        if (!chineseMappingKey[chinese]) {
          chineseMappingKey[chinese] = key;
        }
        return chineseMappingKey;
      },
      {}
    );

    if (fileReplaceDist) {
      fs.removeSync(fileReplaceDist);
      fs.ensureDirSync(fileReplaceDist);
    }

    const config = path.join(this.langDir, ReplaceBundle.configFile);
    if (!fs.existsSync(config)) {
      fs.ensureFileSync(config);
      fs.writeFileSync(config, ReplaceBundle.templateConfigFile);
    }

    console.debug = (...args: any[]) => {
      if (debug) {
        console.log(' '.repeat(this.debugIndent), ...args);
      }
    };
  }

  private filterFilter(name: string) {
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

  private createImportStatement() {
    return `import { lang } from '${this.opt.ouputImportPath}/lang/config';\n`;
  }

  public bundleReplace() {
    try {
      this.replaceAllFiles();
      ReplaceBundle.locales.forEach((name) => {
        const languageJson = path.join(this.langDir, `${name}`);
        let keyMappingText: Record<string, string> =
          fs.readJSONSync(languageJson, { throws: false }) ?? {};

        Object.keys(this.chineseMappingKey).forEach((chinese) => {
          let key = this.chineseMappingKey[chinese];

          if (!keyMappingText[key]) {
            keyMappingText[key] = chinese;
          }
        });

        fs.writeFileSync(languageJson, JSON.stringify(keyMappingText, null, 2));
      });
    } catch (error) {
      console.error(error);
    }
  }

  private static syntaxParsers: SyntaxParser[] = [
    new BlockStart('templateString'),
    new BlockEnd('templateString', '${', '}'),
    new VariableStart('templateString'),
    new VariableEnd('templateString'),

    new BlockStart('htmlTextNode'),
    new BlockEnd('htmlTextNode', '{', '}'),
    new VariableStart('htmlTextNode'),
    new VariableEnd('htmlTextNode'),

    new StringVariableSyntaxParser('doubleQuote'),
    new StringVariableSyntaxParser('singleQuote'),

    new CommentSyntaxParser('line'),
    new CommentSyntaxParser('block'),
  ];

  private getKeyOrSetIfAbsenceFactory(localeMap: string) {
    return (chineseText: string) => {
      let textKey = '';
      let map = localeMap;
      if (this.chineseMappingKey[chineseText]) {
        textKey = this.chineseMappingKey[chineseText];
      } else {
        do {
          textKey = `key${String(this.key++).padStart(4, '0')}`;
        } while (Object.values(this.chineseMappingKey).includes(textKey));
        this.chineseMappingKey[chineseText] = textKey;
      }

      return map + '.' + textKey;
    };
  }

  private debugIndent = 0;

  private replaceAllFiles(srcTargets: string[] = this.opt.srcTargets): void {
    srcTargets = srcTargets.filter(this.filterFilter);
    srcTargets.sort();
    srcTargets.forEach((srcLocate) => {
      if (fs.lstatSync(srcLocate).isDirectory()) {
        return this.replaceAllFiles(
          fs.readdirSync(srcLocate).map((d) => path.join(srcLocate, d))
        );
      }

      let file = fs.readFileSync(srcLocate, 'utf-8');

      const exisitingMap = file.match(
        /((ctx\.lang)|(commonlang)|(lang))\./
      )?.[1];

      const fileReplaceInfo = new FileReplaceInfo(
        file,
        srcLocate,
        this.getKeyOrSetIfAbsenceFactory(exisitingMap ?? 'lang')
      );
      while (fileReplaceInfo.inFileRange()) {
        const syntaxParsers = ReplaceBundle.syntaxParsers.filter(
          (syntaxParser) => syntaxParser.match(fileReplaceInfo)
        );
        if (syntaxParsers.length > 1) {
          throw new Error(
            'matched parsers:' +
              syntaxParsers.map((parser) => parser.getName()) +
              ' at' +
              fileReplaceInfo.pos +
              'should only match one '
          );
        }
        if (syntaxParsers.length == 1) {
          this.debugIndent += 2;

          syntaxParsers[0].handle(fileReplaceInfo);

          this.debugIndent -= 2;
        }
        fileReplaceInfo.pos++;
      }

      if (fileReplaceInfo.stack.length > 0) {
        console.error(
          'templateString or HtmlTextNode not handle correct: ',
          fileReplaceInfo.stack
        );
        throw new Error('stack should be empty');
      }
      if (fileReplaceInfo.positionToReplace.length === 0) {
        return;
      }

      fileReplaceInfo.positionToReplace.sort((a, b) => b.startPos - a.startPos);
      let prevStart: number | null = null;
      fileReplaceInfo.positionToReplace.forEach(
        ({ startPos, endPos, newText }) => {
          if (prevStart === null) {
            prevStart = startPos;
          } else if (endPos >= prevStart) {
            throw new Error(`error parse at${prevStart}`);
          }
          file = file.slice(0, startPos) + newText + file.slice(endPos + 1);
        }
      );
      fileReplaceInfo.clear();
      if (!exisitingMap) {
        file = this.createImportStatement() + file;
      }
      if (this.opt.fileReplaceOverwirte) {
        fs.writeFileSync(srcLocate, file);
      } else {
        fs.writeFileSync(
          path.join(this.opt.fileReplaceDist, path.basename(srcLocate)),
          file
        );
      }
    });
  }
}
