#!/usr/bin/env node

const { execSync } = require("child_process");

(async function () {
  const args = process.argv;
  const target = args[2];
  let dest = "";
  let type = "dir";
  switch (target) {
    case "bff":
    case "bf":
      dest = "C:\\work\\eh-bff";
      break;
    case "ui":
    case "u":
      dest = "C:\\work\\eh-ui";
      break;
    case "command":
    case "c":
      dest = "C:\\work\\command";
      break;
    case "log":
    case "l":
      dest = "C:\\work\\shi_nai_de_log";
      break;
    case "host":
    case "hosts":
    case "h":
      type = "file";
      dest = "C:\\Windows\\System32\\drivers\\etc\\hosts";
      break;
    case "combff":
      dest = "C:\\work\\comp-data-quality-bff";
      break;
    case "comui":
      dest = "C:\\work\\comp-data-quality-ui";
      break;
    default:
      break;
  }
  let command = `cd ${dest} && code ./`;
  if (type == "file") {
    command = `code ${dest}`;
  }
  await execSync(command, { stdio: "inherit" });
})();
