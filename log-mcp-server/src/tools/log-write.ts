// TODO: Implement file locking for concurrent write safety (WRITE_LOCK_TIMEOUT)
// Current single-process stdio mode does not require file locking.
// When multi-process support is added, implement proper-lockfile or similar.

/**
 * log_write — 日志写入 Tool
 * 校验输入 → 自动补充 id/timestamp/_meta → 写入 JSONL
 */
import crypto from "node:crypto";
import { z } from "zod";
import { getLogFilePath, SCHEMA_VERSION } from "../config.js";
import { appendLine } from "../utils/jsonl-store.js";
import { LOG_TYPE_SCHEMAS } from "../schemas/log-write.schema.js";
import type { LogType } from "../types/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** Tool handler 入参类型 */
interface LogWriteArgs {
  logType: LogType;
  data: Record<string, unknown>;
}

/** 成功响应 */
function successResult(id: string, logType: string): CallToolResult {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          success: true,
          id,
          logType,
          message: `Successfully wrote to ${logType}.jsonl`,
        }),
      },
    ],
  };
}

/** 错误响应 */
function errorResult(
  errorCode: string,
  message: string,
  details?: unknown
): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          success: false,
          errorCode,
          message,
          ...(details !== undefined ? { details } : {}),
        }),
      },
    ],
  };
}

/**
 * log_write 主处理函数
 */
export async function handleLogWrite(args: LogWriteArgs): Promise<CallToolResult> {
  try {
    const { logType, data } = args;

    // 1. 校验 logType（schema 层已做，这里做二次防护）
    const validLogTypes = Object.keys(LOG_TYPE_SCHEMAS);
    if (!validLogTypes.includes(logType)) {
      return errorResult(
        "WRITE_INVALID_LOG_TYPE",
        `Invalid logType: ${logType}. Must be one of: ${validLogTypes.join(", ")}`
      );
    }

    // 2. 按 logType 对应的 schema 校验 data
    const schema = LOG_TYPE_SCHEMAS[logType];
    const parseResult = schema.safeParse(data);
    if (!parseResult.success) {
      const details = parseResult.error.issues.map((issue: z.ZodIssue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResult(
        "WRITE_VALIDATION_FAILED",
        "Data validation failed",
        details
      );
    }

    // 3. 自动补充 id, timestamp, _meta（覆盖用户传入的）
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const record: Record<string, unknown> = {
      ...parseResult.data,
      id,
      timestamp: now,
      source: (data["source"] as string) || "system",
      _meta: {
        version: SCHEMA_VERSION,
        createdAt: now,
        writtenBy: "log-mcp-server",
      },
    };

    // 4. 写入 JSONL 文件
    const filePath = getLogFilePath(logType);
    await appendLine(filePath, record);

    // 5. 返回成功
    return successResult(id, logType);
  } catch (err: unknown) {
    // 文件写入错误
    if (isNodeError(err) && (err.code === "ENOSPC" || err.code === "EACCES" || err.code === "EPERM")) {
      console.error(`[log-write] File write error:`, err);
      return errorResult("WRITE_FILE_ERROR", "Failed to write log record to file");
    }
    console.error(`[log-write] Internal error:`, err);
    return errorResult(
      "WRITE_INTERNAL_ERROR",
      "An unexpected error occurred while writing the log record"
    );
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
