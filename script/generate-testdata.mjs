#!/usr/bin/env node
/**
 * 按 testdata2.xlsx 的表头与各 Sheet 首行样本，生成指定行数的测试 Excel。
 * - 总条数 N **均分到 3 个 Sheet**（一类 / 非常规名单 / 接力棒）：先余数在前几个表各多 1 行
 * - 「客户名称」「ccif」在**整本工作簿内**唯一（连续编号）
 * - 「负责人」「分中心负责人」从固定名单轮换，便于出现相同负责人
 *
 * 用法:
 *   node generate-testdata.mjs <条数> [输出路径.xlsx]
 *   node generate-testdata.mjs 300
 *   node generate-testdata.mjs 99 ./batch.xlsx
 *
 * 环境变量:
 *   TEMPLATE=testdata2.xlsx  指定模板文件（默认与脚本同目录下 testdata2.xlsx）
 */

import XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SHEET_NAMES = ["一类", "非常规名单", "接力棒"];

/** 表头中的换行与 key 对齐 */
function headerKey(h) {
  return String(h ?? "").replace(/\n/g, "");
}

function rowToObject(headers, row) {
  const o = {};
  headers.forEach((h, i) => {
    o[headerKey(h)] = row[i];
  });
  return o;
}

function objectToRow(headers, obj) {
  return headers.map((h) => {
    const key = headerKey(h);
    const v = obj[key];
    return v === undefined || v === null ? "" : v;
  });
}

/** 将 N 条分到 3 张表：例如 10 → 4,3,3；7 → 3,2,2；2 → 1,1,0 */
function splitAcrossThree(n) {
  const base = Math.floor(n / 3);
  const rem = n % 3;
  return [0, 1, 2].map((i) => base + (i < rem ? 1 : 0));
}

/** 负责人池：故意重复，模拟多人共用或同一人多客户 */
const DEFAULT_OWNERS = [
  "邹伟",
  "邹伟",
  "张三",
  "李四",
  "王五",
  "赵六",
  "钱七",
];

function uniqueCcif(index) {
  const num = 1_000_000_000_000 + index;
  return `99${String(num).slice(-14)}`;
}

function uniqueCustomerName(index) {
  return `批量测试企业${String(index + 1).padStart(6, "0")}有限公司`;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let count = null;
  let outPath = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") {
      console.log(`用法: node generate-testdata.mjs <条数> [输出.xlsx]`);
      console.log(`  条数会均分到「一类」「非常规名单」「接力棒」三个 Sheet。`);
      process.exit(0);
    }
    if (/^\d+$/.test(a)) {
      count = parseInt(a, 10);
      continue;
    }
    if (a.endsWith(".xlsx") || a.endsWith(".xls")) {
      outPath = path.resolve(a);
    }
  }
  if (count == null || count < 1) {
    console.error("请指定正整数条数，例如: node generate-testdata.mjs 100");
    process.exit(1);
  }
  if (!outPath) {
    outPath = path.join(__dirname, `generated-enterprise-${count}.xlsx`);
  }
  return { count, outPath };
}

const { count, outPath } = parseArgs(process.argv);
const templatePath = path.join(
  __dirname,
  process.env.TEMPLATE || "testdata2.xlsx"
);

const wb = XLSX.readFile(templatePath);
for (const n of SHEET_NAMES) {
  if (!wb.Sheets[n]) {
    console.error(`模板中缺少工作表「${n}」，请检查 ${templatePath}`);
    process.exit(1);
  }
}

const perSheet = splitAcrossThree(count);
let globalRow = 0;

for (let s = 0; s < SHEET_NAMES.length; s++) {
  const sheetName = SHEET_NAMES[s];
  const nRows = perSheet[s];
  const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    defval: "",
  });
  const headers = data[0];
  if (!headers?.length) {
    console.error(`「${sheetName}」无表头`);
    process.exit(1);
  }
  const sampleRow = data[1] || [];
  const baseObj = rowToObject(headers, sampleRow);

  const rows = [headers];
  for (let r = 0; r < nRows; r++) {
    const owner = DEFAULT_OWNERS[globalRow % DEFAULT_OWNERS.length];
    const next = {
      ...baseObj,
      客户名称: uniqueCustomerName(globalRow),
      负责人: owner,
      分中心负责人: owner,
      ccif: uniqueCcif(globalRow),
    };
    rows.push(objectToRow(headers, next));
    globalRow += 1;
  }
  wb.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(rows);
}

wb.SheetNames = [...SHEET_NAMES];

XLSX.writeFile(wb, outPath);

console.log(`已生成: ${outPath}`);
console.log(`  共 ${count} 条，分到 3 个 Sheet：`);
SHEET_NAMES.forEach((name, i) => {
  console.log(`    · ${name}: ${perSheet[i]} 行`);
});
console.log(
  `  客户名称 / ccif 全书唯一；负责人从 ${DEFAULT_OWNERS.length} 人池中轮换（含重复）`
);
