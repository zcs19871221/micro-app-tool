/* eslint-disable no-bitwise */
/* eslint-disable no-underscore-dangle */
import * as fs from 'fs-extra';
import * as path from 'path';
import { ReplaceBundle } from '../ReplaceBundle';

const testDir = path.join(process.cwd(), 'i18n/test');

const dist = path.join(testDir, 'dist');

fs.ensureDirSync(dist);
const replaceBundle = new ReplaceBundle({
  outputDir: 'c:\\work\\eh-ui\\assets',
  fileReplaceOverwirte: true,
  srcTargets: [
    "C:\\work\\eh-ui\\components\\charts\\ChartLineEditorForm.tsx"
    // 'C:\\work\\eh-ui\\components',
    // 'C:\\work\\eh-ui\\pages',
    // 'C:\\work\\eh-ui\\components',
    // 'C:\\work\\eh-ui\\middleware',
    // 'C:\\work\\eh-ui\\utils',
    // 'C:\\work\\eh-ui\\modules',
  ],
  ouputImportPath: 'Ass',
  debug: true,
});
replaceBundle.bundleReplace();
