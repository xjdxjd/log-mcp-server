import path from "node:path";

/**
 * 配置模块
 * 数据目录路径从环境变量 LOG_DATA_DIR 读取
 * 默认值为 logs
 */

/** 数据目录的相对路径（相对于 cwd） */
const DEFAULT_DATA_DIR = "logs";

/** 获取数据目录的绝对路径 */
export function getDataDir(): string {
  const dataDir = process.env["LOG_DATA_DIR"] ?? DEFAULT_DATA_DIR;
  return path.resolve(process.cwd(), dataDir);
}

/** 根据 logType 获取 JSONL 文件的完整路径 */
export function getLogFilePath(logType: string): string {
  return path.join(getDataDir(), `${logType}.jsonl`);
}

/** Server 信息 */
export const SERVER_NAME = "log-mcp-server";
export const SERVER_VERSION = "1.0.0";

/** 分页默认值 */
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;
export const DEFAULT_OFFSET = 0;

/** Schema 版本号 */
export const SCHEMA_VERSION = 1;
