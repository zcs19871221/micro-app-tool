/* eslint-disable no-bitwise */
/* eslint-disable no-underscore-dangle */
import * as fs from 'fs-extra';
import * as assert from 'assert';
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

const equals = (dist: string) => {
  fs.readdirSync(dist).map((item) => {
    item = path.join(dist, item);
    if (fs.lstatSync(item).isDirectory()) {
      equals(item);
    } else {
      assert.equal(
        fs.readFileSync(item, 'utf-8'),
        fs.readFileSync(item.replace('dist', 'expected'), 'utf-8'),
        'equals ' + path.basename(item)
      );
    }
  });
};

equals(dist);
console.log('allPass 😃');
