import fs from "node:fs";

const file = "src/App.tsx";
const src = fs.readFileSync(file, "utf8");
const lines = src.split(/\r?\n/);

const patterns = [
  "client_portal",
  "stage_one_onboard",
  "hasLiveClientSession",
  "getLiveClientLandingPage",
  "LiveClientWorkflowRouter",
  "ClientIntakeDashboard"
];

const hits = new Set();

for (let i = 0; i < lines.length; i++) {
  if (patterns.some(pattern => lines[i].includes(pattern))) {
    const start = Math.max(0, i - 18);
    const end = Math.min(lines.length - 1, i + 35);

    for (let n = start; n <= end; n++) {
      hits.add(n);
    }
  }
}

const ordered = [...hits].sort((a, b) => a - b);

let output = "";

for (const n of ordered) {
  output += `${String(n + 1).padStart(5, " ")} | ${lines[n]}\n`;
}

fs.writeFileSync(
  "M5_5_CURRENT_APP_ROUTING.txt",
  output,
  "utf8"
);

console.log("");
console.log("============================================================");
console.log(" M5.5 CURRENT APP ROUTING EXTRACT COMPLETE");
console.log("============================================================");
console.log("");
console.log("File: M5_5_CURRENT_APP_ROUTING.txt");
console.log("");
console.log("No source code modified.");
console.log("No repository scan performed.");
console.log("No OpenAI API used.");
console.log("");

console.log(output);
