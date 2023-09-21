const fs = require('fs');
const path = require('path');

fs.writeFileSync(
  path.join(__dirname, '../eh-ui/scripts/microApp.mjs'),
  fs.readFileSync(path.join(__dirname, 'build/microApp.js'))
);

fs.writeFileSync(
  path.join(__dirname, '../eh-ui/scripts/server.html'),
  fs.readFileSync(path.join(__dirname, 'server.html'))
);
