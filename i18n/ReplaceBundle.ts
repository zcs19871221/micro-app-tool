import * as fs from 'fs-extra';
import * as path from 'path';
import { FileReplacer } from './FileReplacer';

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
  langTemplateConfigFile: string;
  debug: boolean;
};

export class ReplaceBundle {
  private chineseMappingKey: Record<string, string>;

  private key: number = 1;

  private readonly langDir: string;

  private static locales: string[] = ['zh.json', 'en.json'];

  private static configFile: string = 'config.ts';

  constructor(private readonly opt: ReplaceBundleOpt) {
    const { outputDir, fileReplaceDist, langTemplateConfigFile } = this.opt;

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
      fs.writeFileSync(config, fs.readFileSync(langTemplateConfigFile));
    }
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

  private createImportStatement(outputDir: string) {
    const langLocate =
      outputDir[0].toUpperCase() +
      outputDir.slice(1, 3) +
      outputDir.slice(outputDir.indexOf('/'));

    return `import { lang } from '${langLocate}/lang/config';\n`;
  }

  public debug(): boolean {
    return this.opt.debug ?? false;
  }
  public async bundleReplace() {
    try {
      await Promise.all(
        ReplaceBundle.locales.map(async (name) => {
          const languageJson = path.join(this.langDir, `${name}.json`);
          let keyMappingText: Record<string, string> =
            (await fs.readJson(languageJson, { throws: false })) ?? {};

          Object.keys(this.chineseMappingKey).forEach((chinese) => {
            let key = this.chineseMappingKey[chinese];

            if (!keyMappingText[key]) {
              keyMappingText[key] = chinese;
            }
          });

          await fs.writeFile(
            languageJson,
            JSON.stringify(keyMappingText, null, 2)
          );
        })
      );
    } catch (error) {
      console.error(error);
    }
  }

  public getKeyOrSetIfAbsence(chineseText: string, localeMap: string) {
    let textKey = '';
    if (this.chineseMappingKey[chineseText]) {
      textKey = this.chineseMappingKey[chineseText];
    } else {
      textKey = `${localeMap ?? 'lang'}.key${this.key++}`;
      this.chineseMappingKey[chineseText] = textKey;
    }

    return textKey;
  }

  private async replaceAllFiles(srcDirs: string[]): Promise<void> {
    await Promise.all(
      srcDirs.filter(this.filterFilter).map(async (srcLocate) => {
        if ((await fs.promises.lstat(srcLocate)).isDirectory()) {
          return this.replaceAllFiles(
            (await fs.promises.readdir(srcLocate)).map((d) =>
              path.join(srcLocate, d)
            )
          );
        }

        const file = await fs.promises.readFile(srcLocate, 'utf-8');

        const exisitingMap = file.match(
          /((ctx\.lang)|(commonlang)|(lang))\./
        )?.[1];

        const fileReplacer = new FileReplacer(
          file,
          this,
          exisitingMap ?? 'lang'
        );
        let newFile = fileReplacer.replace();
        fileReplacer.clear();

        if (file !== newFile) {
          if (!exisitingMap) {
            newFile = this.createImportStatement(this.opt.outputDir) + file;
          }
          if (this.opt.fileReplaceOverwirte) {
            await fs.promises.writeFile(srcLocate, newFile);
          } else {
            await fs.promises.writeFile(this.opt.fileReplaceDist, newFile);
          }
        }
      })
    );
  }
}
