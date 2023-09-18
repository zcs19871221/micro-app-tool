const fs = require("fs");
const path = require("path");

fs.renameSync(
  path.join(__dirname, "build/microApp.js"),
  path.join(__dirname, "build/microApp.mjs")
);

fs.writeFileSync(
  path.join(__dirname, "./build/server.html"),
  fs.readFileSync(path.join(__dirname, "server.html"))
);
