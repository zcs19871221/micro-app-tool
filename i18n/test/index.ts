/* eslint-disable no-bitwise */
/* eslint-disable no-underscore-dangle */
import * as fs from 'fs-extra';
import * as path from 'path';
import { ReplaceBundle } from '../ReplaceBundle';

const testDir = path.join(process.cwd(), 'i18n/test');

const dist = path.join(testDir, 'dist');

fs.ensureDirSync(dist);
const replaceBundle = new ReplaceBundle({
  outputDir: dist,
  fileReplaceDist: dist,
  srcTargets: [path.join(testDir, 'test.tsx')],
  ouputImportPath: 'Test/dist',
  debug: true,
});
replaceBundle.bundleReplace();
