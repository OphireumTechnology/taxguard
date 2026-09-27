import fs from "node:fs";

const file = "src/App.tsx";
let src = fs.readFileSync(file, "utf8");

const importLine =
  "import { LiveClientWorkflowRouter } from './components/workflow/LiveClientWorkflowRouter';";

if (!src.includes(importLine)) {

  const imports = [...src.matchAll(/^import[\s\S]*?;\s*$/gm)];

  if (imports.length === 0) {
    console.error("STOP: No ES module imports found in src/App.tsx.");
    process.exit(1);
  }

  const last = imports[imports.length - 1];

  const insertAt =
    last.index + last[0].length;

  src =
    src.slice(0, insertAt) +
    "\n" +
    importLine +
    src.slice(insertAt);

  fs.writeFileSync(file, src, "utf8");

  console.log("PASS: LiveClientWorkflowRouter import inserted.");
} else {
  console.log("PASS: LiveClientWorkflowRouter import already exists.");
}

console.log("PASS: App.tsx import repair complete.");
