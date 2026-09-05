import { copyFileSync, readFileSync, writeFileSync } from "node:fs";

copyFileSync("dist/index.html", "megabonk.html");
const html = readFileSync("megabonk.html", "utf8").replace(
  /<script type="module" crossorigin>/,
  '<script type="module">',
);
writeFileSync("megabonk.html", html);
console.log("wrote megabonk.html");
