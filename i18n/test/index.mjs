/* eslint-disable no-bitwise */
/* eslint-disable no-underscore-dangle */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { replaceAndGenerate } from '../run.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dist = path.join(__dirname, 'dist');
const newDir = path.join(dist, 'new');
const mergeDir = path.join(dist, 'merge');

if (!fs.existsSync(dist)) {
  fs.mkdirSync(dist);
}
[newDir, mergeDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
});

replaceAndGenerate(['i18n/test/new/index.tsx'], 'i18n/test/dist/new', true);
