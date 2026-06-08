import fs from "node:fs/promises";
import path from "node:path";

/**
 * JSONL 文件读写工具
 * 提供 append-only 写入和多种读取模式
 */

/** readAll / readFiltered 的返回结构，包含解析错误信息 */
export interface ReadResult {
  records: Record<string, unknown>[];
  parseErrors: { line: number; error: string }[];
}

/**
 * 追加一行 JSON 到指定文件
 * 如果文件不存在，自动创建
 */
export async function appendLine(
  filePath: string,
  data: Record<string, unknown>
): Promise<void> {
  await ensureFile(filePath);
  const line = JSON.stringify(data) + "\n";
  await fs.appendFile(filePath, line, "utf-8");
}

/**
 * 读取 JSONL 文件的所有行，解析为对象数组
 * 返回解析结果和解析错误
 */
export async function readAll(
  filePath: string
): Promise<ReadResult> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return parseJsonl(content);
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return { records: [], parseErrors: [] };
    }
    throw err;
  }
}

/**
 * 带过滤条件读取 JSONL 文件
 */
export async function readFiltered(
  filePath: string,
  predicate?: (record: Record<string, unknown>) => boolean
): Promise<ReadResult> {
  const result = await readAll(filePath);
  if (!predicate) return result;
  return { ...result, records: result.records.filter(predicate) };
}

/**
 * 确保文件及其目录存在
 * 如果不存在则创建
 */
export async function ensureFile(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "", "utf-8");
  }
}

/**
 * 检查文件是否存在
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ── 内部工具 ──────────────────────

function parseJsonl(content: string): ReadResult {
  const lines = content.split("\n");
  const records: Record<string, unknown>[] = [];
  const parseErrors: { line: number; error: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "") continue;
    try {
      records.push(JSON.parse(trimmed) as Record<string, unknown>);
    } catch (err: unknown) {
      parseErrors.push({
        line: i + 1,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { records, parseErrors };
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
