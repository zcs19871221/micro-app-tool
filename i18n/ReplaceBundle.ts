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

      const newFile = await fileReplace({
        src: targets,
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
