import XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputFile = process.argv[2] || "testdata.xlsx";
const filePath = path.resolve(__dirname, inputFile);

const workbook = XLSX.readFile(filePath);
const sheetNames = workbook.SheetNames;

const sheetHeaders = {};
for (const name of sheetNames) {
  const sheet = workbook.Sheets[name];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  sheetHeaders[name] = (data[0] || []).map((h) => String(h).replace(/\n/g, ""));
}

console.log("=".repeat(60));
const fileName = path.basename(filePath);
console.log(`${fileName} 三个 Sheet 字段对比分析`);
console.log("=".repeat(60));

for (const name of sheetNames) {
  console.log(`\n📄 [${name}] 共 ${sheetHeaders[name].length} 个字段`);
}

const sets = sheetNames.map((name) => new Set(sheetHeaders[name]));
const allFields = new Set(sheetNames.flatMap((name) => sheetHeaders[name]));

let common = [...allFields].filter((f) => sets.every((s) => s.has(f)));
common = sortByFirstAppearance(common, sheetHeaders[sheetNames[0]]);

console.log("\n" + "=".repeat(60));
console.log(`✅ 三个 Sheet 共有字段（${common.length} 个）`);
console.log("=".repeat(60));
common.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));

console.log("\n" + "=".repeat(60));
console.log("🔍 两两对比：相同与不同");
console.log("=".repeat(60));

for (let i = 0; i < sheetNames.length; i++) {
  for (let j = i + 1; j < sheetNames.length; j++) {
    const nameA = sheetNames[i];
    const nameB = sheetNames[j];
    const setA = sets[i];
    const setB = sets[j];

    const shared = [...allFields].filter((f) => setA.has(f) && setB.has(f));
    const onlyA = sheetHeaders[nameA].filter((f) => !setB.has(f));
    const onlyB = sheetHeaders[nameB].filter((f) => !setA.has(f));

    console.log(`\n--- [${nameA}] vs [${nameB}] ---`);
    console.log(`  共有字段: ${shared.length} 个`);

    if (onlyA.length > 0) {
      console.log(`  仅 [${nameA}] 有（${onlyA.length} 个）:`);
      onlyA.forEach((f) => console.log(`    - ${f}`));
    }
    if (onlyB.length > 0) {
      console.log(`  仅 [${nameB}] 有（${onlyB.length} 个）:`);
      onlyB.forEach((f) => console.log(`    - ${f}`));
    }
  }
}

console.log("\n" + "=".repeat(60));
console.log("📋 各 Sheet 独有字段汇总");
console.log("=".repeat(60));

for (let i = 0; i < sheetNames.length; i++) {
  const name = sheetNames[i];
  const otherSets = sets.filter((_, idx) => idx !== i);
  const unique = sheetHeaders[name].filter((f) =>
    otherSets.every((s) => !s.has(f))
  );

  console.log(`\n🔸 仅 [${name}] 独有（${unique.length} 个）:`);
  if (unique.length === 0) {
    console.log("  （无）");
  } else {
    unique.forEach((f) => console.log(`  - ${f}`));
  }
}

console.log("\n" + "=".repeat(60));
console.log("⚠️  疑似相似但名称不完全一致的字段");
console.log("=".repeat(60));

const uniquePerSheet = sheetNames.map((name, i) => {
  const otherSets = sets.filter((_, idx) => idx !== i);
  return sheetHeaders[name].filter((f) => otherSets.some((s) => !s.has(f)));
});

const allUnique = [...new Set(uniquePerSheet.flat())];
const similar = [];
for (let i = 0; i < allUnique.length; i++) {
  for (let j = i + 1; j < allUnique.length; j++) {
    const a = allUnique[i];
    const b = allUnique[j];
    if (a === b) continue;
    const clean = (s) => s.replace(/[（()）\s]/g, "");
    if (
      clean(a).includes(clean(b)) ||
      clean(b).includes(clean(a)) ||
      levenshtein(a, b) <= 3
    ) {
      const aIn = sheetNames.filter((_, idx) => sets[idx].has(a));
      const bIn = sheetNames.filter((_, idx) => sets[idx].has(b));
      if (aIn.join() !== bIn.join()) {
        similar.push({ a, b, aIn, bIn });
      }
    }
  }
}

if (similar.length === 0) {
  console.log("  （未发现）");
} else {
  similar.forEach(({ a, b, aIn, bIn }) => {
    console.log(`  "${a}" (在: ${aIn.join(", ")})`);
    console.log(`  "${b}" (在: ${bIn.join(", ")})`);
    console.log();
  });
}

function sortByFirstAppearance(fields, reference) {
  const order = new Map(reference.map((f, i) => [f, i]));
  return [...fields].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
