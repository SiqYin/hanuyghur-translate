"use strict";
const readline = require("readline");
const U = require("./ugconv.js");

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
  if (!line.trim()) return;
  try {
    const o = JSON.parse(line);
    if (o.uey && !o.uly) o.uly = U.uey2ul(U.normalizeUey(o.uey));
    process.stdout.write(JSON.stringify(o) + "\n");
  } catch (e) {
    process.stderr.write("bad line\n");
  }
});
