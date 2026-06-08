/**
 * log_query — 条件查询 Tool
 * 读取 JSONL → 过滤 → 分页 → 返回
 */
import { getLogFilePath, DEFAULT_LIMIT, DEFAULT_OFFSET } from "../config.js";
import { readAll, fileExists } from "../utils/jsonl-store.js";
import { createTimeFilter, isValidTimeRange, type TimeRange } from "../utils/time-filter.js";
import type { LogType } from "../types/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** 查询过滤条件 */
interface QueryFilters {
  timeRange?: { start: string; end: string };
  agent?: string;
  level?: "P0" | "P1" | "P2";
  status?: string;
  result?: string;
  keyword?: string;
}

/** Tool handler 入参类型 */
interface LogQueryArgs {
  logType: LogType;
  filters?: QueryFilters;
  limit?: number;
  offset?: number;
}

// ── agent 字段匹配规则（api-contract §3.5）──────────────
const AGENT_FIELD_MAP: Record<string, { fields: string[]; arrayFields?: string[] }> = {
  "agent-calls":       { fields: ["caller", "callee"] },
  "tasks":             { fields: [], arrayFields: ["agents"] },
  "violations":        { fields: ["agent"] },
  "feedback":          { fields: ["source"] },
  "appeals":           { fields: ["appellant", "handler"] },
  "changes":           { fields: ["responsible"] },
  "perf-reports":      { fields: [], arrayFields: ["agentScores"] },
  "inspector-actions": { fields: ["target"] },
};

/** 成功响应 */
function successResult(
  total: number,
  records: Record<string, unknown>[],
  offset: number,
  limit: number,
  warnings?: string[]
): CallToolResult {
  const count = records.length;
  const response: Record<string, unknown> = {
    total,
    records,
    pagination: {
      offset,
      count,
      limit,
      hasMore: offset + count < total,
    },
  };
  if (warnings && warnings.length > 0) {
    response["_warnings"] = warnings;
  }
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(response),
      },
    ],
  };
}

/** 错误响应 */
function errorResult(errorCode: string, message: string): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ success: false, errorCode, message }),
      },
    ],
  };
}

/**
 * log_query 主处理函数
 */
export async function handleLogQuery(args: LogQueryArgs): Promise<CallToolResult> {
  try {
    const { logType, filters, limit = DEFAULT_LIMIT, offset = DEFAULT_OFFSET } = args;

    // 1. 校验文件是否存在
    const filePath = getLogFilePath(logType);
    const exists = await fileExists(filePath);
    if (!exists) {
      // 文件不存在时返回空结果（非错误）
      return successResult(0, [], offset, limit);
    }

    // 2. 读取全部记录
    let allRecords: Record<string, unknown>[];
    let parseErrors: { line: number; error: string }[];
    try {
      const readResult = await readAll(filePath);
      allRecords = readResult.records;
      parseErrors = readResult.parseErrors;
    } catch (err: unknown) {
      console.error(`[log-query] File read error:`, err);
      return errorResult(
        "QUERY_FILE_READ_ERROR",
        "Failed to read log file"
      );
    }

    // 2a. 检查解析错误是否超过阈值（CF-005: QUERY_PARSE_ERROR）
    if (parseErrors.length > 0) {
      const errorThreshold = Math.max(50, allRecords.length * 0.1);
      if (parseErrors.length > errorThreshold) {
        console.error(`[log-query] Excessive parse errors: ${parseErrors.length} errors out of ${allRecords.length + parseErrors.length} lines`);
        return errorResult(
          "QUERY_PARSE_ERROR",
          `Log file is severely corrupted: ${parseErrors.length} lines failed to parse. Please check the log file integrity.`
        );
      }
    }

    // 3. 应用过滤条件
    let filtered = allRecords;

    if (filters) {
      // 3a. 时间范围过滤
      if (filters.timeRange) {
        if (!isValidTimeRange(filters.timeRange as TimeRange)) {
          return errorResult(
            "QUERY_INVALID_TIME_RANGE",
            "Invalid time range: start must be before or equal to end"
          );
        }
        const timeFilter = createTimeFilter(filters.timeRange as TimeRange);
        filtered = filtered.filter(timeFilter);
      }

      // 3b. agent 过滤（跨字段匹配）
      if (filters.agent) {
        const agentLower = filters.agent.toLowerCase();
        const rule = AGENT_FIELD_MAP[logType];
        if (rule) {
          filtered = filtered.filter((record) =>
            matchAgent(record, agentLower, rule.fields, rule.arrayFields ?? [], logType)
          );
        }
      }

      // 3c. level 过滤
      if (filters.level) {
        filtered = filtered.filter(
          (record) => record["level"] === filters.level
        );
      }

      // 3d. status 过滤
      if (filters.status) {
        filtered = filtered.filter(
          (record) => record["status"] === filters.status
        );
      }

      // 3e. result 过滤
      if (filters.result) {
        filtered = filtered.filter(
          (record) => record["result"] === filters.result
        );
      }

      // 3f. keyword 搜索
      if (filters.keyword) {
        const kwLower = filters.keyword.toLowerCase();
        filtered = filtered.filter((record) =>
          matchKeyword(record, kwLower)
        );
      }
    }

    // 4. 分页
    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit);

    // 5. 构建警告信息
    const warnings: string[] = [];
    if (parseErrors.length > 0) {
      warnings.push(`${parseErrors.length} line(s) in the log file failed to parse and were skipped`);
    }

    // 6. 返回
    return successResult(total, paged, offset, limit, warnings);
  } catch (err: unknown) {
    console.error(`[log-query] Internal error:`, err);
    return errorResult(
      "QUERY_INTERNAL_ERROR",
      "An unexpected error occurred while querying log records"
    );
  }
}

// ── 内部工具函数 ──────────────────

/**
 * agent 字段匹配
 * 按 api-contract §3.5 的匹配规则表
 */
function matchAgent(
  record: Record<string, unknown>,
  agentLower: string,
  fields: string[],
  arrayFields: string[],
  logType: string
): boolean {
  // 普通字段匹配
  for (const field of fields) {
    const val = record[field];
    if (typeof val === "string" && val.toLowerCase().includes(agentLower)) {
      return true;
    }
  }

  // 数组字段匹配
  for (const field of arrayFields) {
    const val = record[field];
    if (Array.isArray(val)) {
      // perf-reports 特殊处理：匹配 agentScores[].agent
      if (logType === "perf-reports") {
        for (const item of val) {
          if (
            typeof item === "object" &&
            item !== null &&
            "agent" in item &&
            typeof (item as Record<string, unknown>)["agent"] === "string" &&
            ((item as Record<string, unknown>)["agent"] as string).toLowerCase().includes(agentLower)
          ) {
            return true;
          }
        }
      } else {
        // 普通字符串数组（tasks.agents 等）
        for (const item of val) {
          if (typeof item === "string" && item.toLowerCase().includes(agentLower)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * keyword 搜索
 * 对所有 string 字段做大小写不敏感子串匹配
 * 对 string[] 字段逐元素匹配
 * 不递归搜索嵌套对象
 */
function matchKeyword(record: Record<string, unknown>, kwLower: string): boolean {
  for (const [, value] of Object.entries(record)) {
    if (typeof value === "string") {
      if (value.toLowerCase().includes(kwLower)) return true;
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.toLowerCase().includes(kwLower)) {
          return true;
        }
      }
    }
    // 不递归搜索嵌套对象
  }
  return false;
}
