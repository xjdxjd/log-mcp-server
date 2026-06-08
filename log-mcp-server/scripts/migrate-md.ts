/**
 * Markdown → JSONL 迁移脚本（P1）
 *
 * 解析 .qoder/rules/logs/ 下的 6 个 .md 文件
 * 将真实条目（跳过示例条目）转为 JSONL 格式写入 data/*.jsonl
 *
 * 用法：npx tsx scripts/migrate-md.ts [--dry-run]
 *
 * 注意：这是一个简化的迁移脚本，实际 .md 格式可能不完全规范
 * 采用宽松解析策略，跳过无法解析的条目
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const LOGS_DIR = path.resolve(process.cwd(), ".qoder/rules/logs");
const DATA_DIR = path.resolve(process.cwd(), ".qoder/rules/logs/data");

interface MigrationResult {
  file: string;
  totalEntries: number;
  migratedEntries: number;
  skippedEntries: number;
  errors: string[];
}

/** 检查是否为示例条目 */
function isExampleEntry(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("示例") ||
    lower.includes("example") ||
    lower.includes("sample") ||
    lower.includes("（示例") ||
    lower.includes("(example")
  );
}

/** 简单的 Markdown 表格解析 */
function parseTableRows(content: string): string[][] {
  const lines = content.split("\n");
  const rows: string[][] = [];
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      inTable = false;
      continue;
    }
    if (!inTable) {
      inTable = true;
      continue; // 跳过表头
    }
    // 跳过分隔行
    if (/^\|[\s\-:|]+\|$/.test(trimmed)) continue;

    const cells = trimmed
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    rows.push(cells);
  }
  return rows;
}

/** 迁移 agent-calls.md */
async function migrateAgentCalls(): Promise<MigrationResult> {
  const result: MigrationResult = {
    file: "agent-calls.md",
    totalEntries: 0,
    migratedEntries: 0,
    skippedEntries: 0,
    errors: [],
  };

  try {
    const filePath = path.join(LOGS_DIR, "agent-calls.md");
    const content = await fs.readFile(filePath, "utf-8");
    const rows = parseTableRows(content);
    result.totalEntries = rows.length;

    const outPath = path.join(DATA_DIR, "agent-calls.jsonl");
    await fs.mkdir(DATA_DIR, { recursive: true });

    let output = "";
    for (const row of rows) {
      if (row.length < 4) {
        result.skippedEntries++;
        continue;
      }
      const rawText = row.join(" ");
      if (isExampleEntry(rawText)) {
        result.skippedEntries++;
        continue;
      }

      const now = new Date().toISOString();
      const record = {
        id: crypto.randomUUID(),
        timestamp: now,
        source: "migration",
        caller: row[0] ?? "",
        callee: row[1] ?? "",
        taskDesc: row[2] ?? "",
        callReason: row[3] ?? "",
        result: row[4] ?? "",
        accuracy: "pending",
        _meta: { version: 1, createdAt: now, writtenBy: "migrate-md" },
      };
      output += JSON.stringify(record) + "\n";
      result.migratedEntries++;
    }

    if (!process.argv.includes("--dry-run")) {
      await fs.appendFile(outPath, output, "utf-8");
    }
  } catch (err) {
    result.errors.push(String(err));
  }
  return result;
}

/** 迁移 violations.md */
async function migrateViolations(): Promise<MigrationResult> {
  const result: MigrationResult = {
    file: "violations.md",
    totalEntries: 0,
    migratedEntries: 0,
    skippedEntries: 0,
    errors: [],
  };

  try {
    const filePath = path.join(LOGS_DIR, "violations.md");
    const content = await fs.readFile(filePath, "utf-8");
    const rows = parseTableRows(content);
    result.totalEntries = rows.length;

    const outPath = path.join(DATA_DIR, "violations.jsonl");
    await fs.mkdir(DATA_DIR, { recursive: true });

    let output = "";
    for (const row of rows) {
      if (row.length < 3) {
        result.skippedEntries++;
        continue;
      }
      const rawText = row.join(" ");
      if (isExampleEntry(rawText)) {
        result.skippedEntries++;
        continue;
      }

      const now = new Date().toISOString();
      const level = (row[0] ?? "P2") as string;
      const record = {
        id: crypto.randomUUID(),
        timestamp: now,
        source: "migration",
        level: ["P0", "P1", "P2"].includes(level) ? level : "P2",
        content: row[1] ?? "",
        basis: row[2] ?? "",
        action: row[3] ?? "",
        status: "pending",
        agent: row[4] ?? "unknown",
        _meta: { version: 1, createdAt: now, writtenBy: "migrate-md" },
      };
      output += JSON.stringify(record) + "\n";
      result.migratedEntries++;
    }

    if (!process.argv.includes("--dry-run")) {
      await fs.appendFile(outPath, output, "utf-8");
    }
  } catch (err) {
    result.errors.push(String(err));
  }
  return result;
}

/** 通用迁移函数（用于结构类似的文件） */
async function migrateGeneric(
  mdFile: string,
  jsonlFile: string
): Promise<MigrationResult> {
  const result: MigrationResult = {
    file: mdFile,
    totalEntries: 0,
    migratedEntries: 0,
    skippedEntries: 0,
    errors: [],
  };

  try {
    const filePath = path.join(LOGS_DIR, mdFile);
    const content = await fs.readFile(filePath, "utf-8");
    const rows = parseTableRows(content);
    result.totalEntries = rows.length;

    const outPath = path.join(DATA_DIR, jsonlFile);
    await fs.mkdir(DATA_DIR, { recursive: true });

    let output = "";
    for (const row of rows) {
      if (row.length < 2) {
        result.skippedEntries++;
        continue;
      }
      if (isExampleEntry(row.join(" "))) {
        result.skippedEntries++;
        continue;
      }

      const now = new Date().toISOString();
      const record: Record<string, unknown> = {
        id: crypto.randomUUID(),
        timestamp: now,
        source: "migration",
        _meta: { version: 1, createdAt: now, writtenBy: "migrate-md" },
      };

      // 将表格列按顺序映射为 field_0, field_1, ...
      for (let i = 0; i < row.length; i++) {
        record[`field_${i}`] = row[i];
      }
      output += JSON.stringify(record) + "\n";
      result.migratedEntries++;
    }

    if (!process.argv.includes("--dry-run")) {
      await fs.appendFile(outPath, output, "utf-8");
    }
  } catch (err) {
    result.errors.push(String(err));
  }
  return result;
}

// ── 主流程 ──────────────────

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`\n📦 Markdown → JSONL 迁移脚本${dryRun ? " [DRY-RUN]" : ""}`);
  console.log(`   源目录: ${LOGS_DIR}`);
  console.log(`   目标目录: ${DATA_DIR}\n`);

  const results: MigrationResult[] = [];

  results.push(await migrateAgentCalls());
  results.push(await migrateGeneric("tasks.md", "tasks.jsonl"));
  results.push(await migrateViolations());
  results.push(await migrateGeneric("feedback.md", "feedback.jsonl"));
  results.push(await migrateGeneric("appeals.md", "appeals.jsonl"));
  results.push(await migrateGeneric("changes.md", "changes.jsonl"));

  // 输出迁移报告
  console.log("═".repeat(60));
  console.log("  迁移报告");
  console.log("═".repeat(60));
  let totalAll = 0;
  let migratedAll = 0;
  let skippedAll = 0;

  for (const r of results) {
    console.log(`\n  📄 ${r.file}`);
    console.log(`     总条目: ${r.totalEntries}`);
    console.log(`     已迁移: ${r.migratedEntries}`);
    console.log(`     已跳过: ${r.skippedEntries}`);
    if (r.errors.length > 0) {
      console.log(`     ❌ 错误: ${r.errors.join("; ")}`);
    }
    totalAll += r.totalEntries;
    migratedAll += r.migratedEntries;
    skippedAll += r.skippedEntries;
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  总计: ${totalAll} 条, 迁移 ${migratedAll} 条, 跳过 ${skippedAll} 条`);
  if (totalAll > 0) {
    const rate = ((migratedAll / totalAll) * 100).toFixed(1);
    console.log(`  迁移率: ${rate}%`);
  }
  console.log("═".repeat(60));
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
