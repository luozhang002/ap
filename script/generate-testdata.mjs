#!/usr/bin/env node
/**
 * 按 testdata2.xlsx 的表头与各 Sheet 首行样本，生成指定行数的测试 Excel。
 * - 总条数 N **均分到 3 个 Sheet**（一类 / 非常规名单 / 接力棒）：先余数在前几个表各多 1 行
 * - 「客户名称」「ccif」在**整本工作簿内**唯一（连续编号）
 * - 「负责人」「分中心负责人」从固定名单轮换，便于出现相同负责人
 * - **省 / 市 / 区 / 街道 / 下发地址 / 实际经营地址**：按池轮换，分布在**上海、北京、杭州**的真实地标/楼宇附近，便于地图检索与测试
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

/**
 * 真实可查的公开地标/写字楼地址（省市区街道 + 下发/经营地址），用于地图相关测试。
 * 按行号轮换；同一城市内覆盖不同区、街道与楼宇。
 */
const ADDRESS_POOL = [
  // —— 上海 ——
  {
    所在省: "上海市",
    所在市: "上海市",
    所在区: "浦东新区",
    所在街道: "陆家嘴街道",
    下发地址: "上海市浦东新区陆家嘴环路1000号恒生银行大厦",
    实际经营地址: "上海市浦东新区陆家嘴环路1000号恒生银行大厦15楼",
  },
  {
    所在省: "上海市",
    所在市: "上海市",
    所在区: "黄浦区",
    所在街道: "南京东路街道",
    下发地址: "上海市黄浦区南京东路300号恒基名人购物中心",
    实际经营地址: "上海市黄浦区南京东路300号恒基名人购物中心4层",
  },
  {
    所在省: "上海市",
    所在市: "上海市",
    所在区: "徐汇区",
    所在街道: "湖南路街道",
    下发地址: "上海市徐汇区淮海中路999号环贸广场",
    实际经营地址: "上海市徐汇区淮海中路999号环贸广场写字楼",
  },
  {
    所在省: "上海市",
    所在市: "上海市",
    所在区: "静安区",
    所在街道: "南京西路街道",
    下发地址: "上海市静安区南京西路1601号越洋国际广场",
    实际经营地址: "上海市静安区南京西路1601号越洋国际广场",
  },
  {
    所在省: "上海市",
    所在市: "上海市",
    所在区: "杨浦区",
    所在街道: "五角场街道",
    下发地址: "上海市杨浦区淞沪路303号创智天地广场",
    实际经营地址: "上海市杨浦区淞沪路303号创智天地广场3期",
  },
  {
    所在省: "上海市",
    所在市: "上海市",
    所在区: "长宁区",
    所在街道: "华阳路街道",
    下发地址: "上海市长宁区长宁路1133号长宁来福士广场",
    实际经营地址: "上海市长宁区长宁路1133号来福士办公楼",
  },
  {
    所在省: "上海市",
    所在市: "上海市",
    所在区: "虹口区",
    所在街道: "四川北路街道",
    下发地址: "上海市虹口区四川北路1318号盛邦国际大厦",
    实际经营地址: "上海市虹口区四川北路1318号",
  },
  {
    所在省: "上海市",
    所在市: "上海市",
    所在区: "闵行区",
    所在街道: "莘庄镇",
    下发地址: "上海市闵行区莘松路958弄上海康城",
    实际经营地址: "上海市闵行区莘松路958弄大浪湾道",
  },
  // —— 北京 ——
  {
    所在省: "北京市",
    所在市: "北京市",
    所在区: "朝阳区",
    所在街道: "建外街道",
    下发地址: "北京市朝阳区建国门外大街1号中国国际贸易中心",
    实际经营地址: "北京市朝阳区建国门外大街1号国贸写字楼",
  },
  {
    所在省: "北京市",
    所在市: "北京市",
    所在区: "海淀区",
    所在街道: "中关村街道",
    下发地址: "北京市海淀区中关村大街27号中关村大厦",
    实际经营地址: "北京市海淀区中关村大街27号",
  },
  {
    所在省: "北京市",
    所在市: "北京市",
    所在区: "西城区",
    所在街道: "西长安街街道",
    下发地址: "北京市西城区西单北大街131号西单大悦城",
    实际经营地址: "北京市西城区西单北大街131号",
  },
  {
    所在省: "北京市",
    所在市: "北京市",
    所在区: "东城区",
    所在街道: "东华门街道",
    下发地址: "北京市东城区王府井大街255号北京市百货大楼",
    实际经营地址: "北京市东城区王府井大街255号",
  },
  {
    所在省: "北京市",
    所在市: "北京市",
    所在区: "丰台区",
    所在街道: "丰台街道",
    下发地址: "北京市丰台区丰台北路18号院金唐新光界",
    实际经营地址: "北京市丰台区丰台北路18号",
  },
  {
    所在省: "北京市",
    所在市: "北京市",
    所在区: "石景山区",
    所在街道: "鲁谷街道",
    下发地址: "北京市石景山区石景山路乙18号万达广场",
    实际经营地址: "北京市石景山区石景山路乙18号",
  },
  {
    所在省: "北京市",
    所在市: "北京市",
    所在区: "大兴区",
    所在街道: "荣华街道",
    下发地址: "北京市大兴区荣华中路8号院力宝广场",
    实际经营地址: "北京市大兴区荣华中路8号院",
  },
  {
    所在省: "北京市",
    所在市: "北京市",
    所在区: "通州区",
    所在街道: "北苑街道",
    下发地址: "北京市通州区新华西街58号万达广场",
    实际经营地址: "北京市通州区新华西街58号",
  },
  // —— 杭州 ——
  {
    所在省: "浙江省",
    所在市: "杭州市",
    所在区: "西湖区",
    所在街道: "文新街道",
    下发地址: "浙江省杭州市西湖区文三路259号昌地火炬大厦",
    实际经营地址: "杭州市西湖区文三路259号昌地火炬大厦",
  },
  {
    所在省: "浙江省",
    所在市: "杭州市",
    所在区: "余杭区",
    所在街道: "五常街道",
    下发地址: "浙江省杭州市余杭区文一西路969号阿里巴巴西溪园区",
    实际经营地址: "杭州市余杭区文一西路969号阿里巴巴西溪A区",
  },
  {
    所在省: "浙江省",
    所在市: "杭州市",
    所在区: "滨江区",
    所在街道: "长河街道",
    下发地址: "浙江省杭州市滨江区网商路699号滨江互联网小镇",
    实际经营地址: "杭州市滨江区网商路699号",
  },
  {
    所在省: "浙江省",
    所在市: "杭州市",
    所在区: "上城区",
    所在街道: "四季青街道",
    下发地址: "浙江省杭州市上城区富春路701号杭州万象城",
    实际经营地址: "杭州市上城区富春路701号万象城",
  },
  {
    所在省: "浙江省",
    所在市: "杭州市",
    所在区: "拱墅区",
    所在街道: "大关街道",
    下发地址: "浙江省杭州市拱墅区大关路100号绿地中央广场",
    实际经营地址: "杭州市拱墅区大关路100号",
  },
  {
    所在省: "浙江省",
    所在市: "杭州市",
    所在区: "萧山区",
    所在街道: "北干街道",
    下发地址: "浙江省杭州市萧山区市心中路818号萧山万象汇",
    实际经营地址: "杭州市萧山区市心中路818号",
  },
  {
    所在省: "浙江省",
    所在市: "杭州市",
    所在区: "钱塘区",
    所在街道: "白杨街道",
    下发地址: "浙江省杭州市钱塘区学府街福雷德广场",
    实际经营地址: "杭州市钱塘区学府街福雷德广场",
  },
  {
    所在省: "浙江省",
    所在市: "杭州市",
    所在区: "临平区",
    所在街道: "南苑街道",
    下发地址: "浙江省杭州市临平区迎宾路华元欢乐城",
    实际经营地址: "杭州市临平区迎宾路华元欢乐城",
  },
];

function addressForRow(index) {
  return ADDRESS_POOL[index % ADDRESS_POOL.length];
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
    const addr = addressForRow(globalRow);
    const next = {
      ...baseObj,
      ...addr,
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
console.log(
  `  地址：${ADDRESS_POOL.length} 条真实地标池轮换（上海 / 北京 / 杭州，各区街道楼宇不同）`
);
