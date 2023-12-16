/* eslint-disable no-console */
/* eslint-disable no-underscore-dangle */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { replaceTextWithKey } from './replaceTextWithKey.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectBase = path.join(__dirname, '../');

export const replaceAndGenerate = async (targets, output, test = false) => {
  try {
    if (!output || !targets) {
      throw new Error('need output and targets');
    }

    targets = targets.map((p) => path.join(projectBase, p));
    const outputDir = path.join(projectBase, output);
    const langLocate =
      output[0].toUpperCase() +
      output.slice(1, 3) +
      output.slice(output.indexOf('/'));

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
      let keyMappingText = {};
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
};
