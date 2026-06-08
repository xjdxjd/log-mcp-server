/**
 * log_stats — 聚合统计 Tool
 * 读取 JSONL → 时间过滤 → groupBy 分组 → metrics 计算
 */
import { getLogFilePath } from "../config.js";
import { readAll, fileExists } from "../utils/jsonl-store.js";
import { createTimeFilter, isValidTimeRange, type TimeRange } from "../utils/time-filter.js";
import type { LogType } from "../types/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** groupBy 枚举 */
type GroupByField = "agent" | "level" | "type" | "status" | "result";

/** metrics 枚举 */
type MetricsType = "count" | "rate" | "avg";

/** Tool handler 入参类型 */
interface LogStatsArgs {
  logType: LogType;
  timeRange?: { start: string; end: string };
  groupBy?: GroupByField;
  metrics?: MetricsType;
}

// ── groupBy × logType 兼容性矩阵（api-contract §4.4）──
const GROUP_BY_COMPATIBILITY: Record<string, Set<string>> = {
  "agent":             new Set(["agent-calls", "tasks", "violations", "feedback", "appeals", "changes", "perf-reports", "inspector-actions"]),
  "level":             new Set(["violations", "appeals"]),
  "type":              new Set(["tasks", "changes", "inspector-actions"]),
  "status":            new Set(["violations", "feedback", "appeals", "changes"]),
  "result":            new Set(["agent-calls", "tasks", "appeals"]),
};

// ── metrics × logType 兼容性矩阵（CF-006）──
const RATE_SUPPORTED = new Set(["tasks", "agent-calls"]);
const AVG_SUPPORTED = new Set(["tasks", "appeals"]);

// ── groupBy 对应的实际字段名映射 ─────────────────
const GROUP_BY_FIELD_MAP: Record<string, Record<string, { type: "field" | "arrayField" | "special"; name: string }>> = {
  "agent": {
    "agent-calls":       { type: "field", name: "caller" },
    "tasks":             { type: "arrayField", name: "agents" },
    "violations":        { type: "field", name: "agent" },
    "feedback":          { type: "field", name: "source" },
    "appeals":           { type: "field", name: "appellant" },
    "changes":           { type: "field", name: "responsible" },
    "perf-reports":      { type: "special", name: "agentScores" },
    "inspector-actions": { type: "field", name: "target" },
  },
  "level": {
    "violations": { type: "field", name: "level" },
    "appeals":    { type: "field", name: "level" },
  },
  "type": {
    "tasks":            { type: "field", name: "type" },
    "changes":          { type: "field", name: "changeType" },
    "inspector-actions":{ type: "field", name: "action" },
  },
  "status": {
    "violations": { type: "field", name: "status" },
    "feedback":   { type: "field", name: "status" },
    "appeals":    { type: "field", name: "result" },
    "changes":    { type: "field", name: "status" },
  },
  "result": {
    "agent-calls": { type: "field", name: "accuracy" },
    "tasks":       { type: "field", name: "result" },
    "appeals":     { type: "field", name: "result" },
  },
};

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
 * log_stats 主处理函数
 */
export async function handleLogStats(args: LogStatsArgs): Promise<CallToolResult> {
  try {
    const { logType, timeRange, groupBy, metrics = "count" } = args;

    // 1. 校验 groupBy 兼容性
    if (groupBy) {
      const compat = GROUP_BY_COMPATIBILITY[groupBy];
      if (!compat || !compat.has(logType)) {
        return errorResult(
          "STATS_INVALID_GROUP_BY",
          `groupBy "${groupBy}" is not compatible with logType "${logType}"`
        );
      }
    }

    // 1a. 校验 metrics × logType 兼容性（CF-006）
    if (metrics === "rate" && !RATE_SUPPORTED.has(logType)) {
      return errorResult(
        "STATS_INVALID_METRICS",
        `metrics "rate" is not supported for logType "${logType}". Supported: ${[...RATE_SUPPORTED].join(", ")}`
      );
    }
    if (metrics === "avg" && !AVG_SUPPORTED.has(logType)) {
      return errorResult(
        "STATS_INVALID_METRICS",
        `metrics "avg" is not supported for logType "${logType}". Supported: ${[...AVG_SUPPORTED].join(", ")}`
      );
    }

    // 2. 校验时间范围
    if (timeRange && !isValidTimeRange(timeRange as TimeRange)) {
      return errorResult(
        "STATS_INVALID_TIME_RANGE",
        "Invalid time range: start must be before or equal to end"
      );
    }

    // 3. 读取数据
    const filePath = getLogFilePath(logType);
    const exists = await fileExists(filePath);
    let allRecords: Record<string, unknown>[] = [];
    let parseErrors: { line: number; error: string }[] = [];

    if (exists) {
      try {
        const readResult = await readAll(filePath);
        allRecords = readResult.records;
        parseErrors = readResult.parseErrors;
      } catch (err: unknown) {
        console.error(`[log-stats] File read error:`, err);
        return errorResult(
          "STATS_FILE_READ_ERROR",
          "Failed to read log file"
        );
      }
    }

    // 4. 时间过滤
    let records = allRecords;
    if (timeRange) {
      const timeFilter = createTimeFilter(timeRange as TimeRange);
      records = records.filter(timeFilter);
    }

    const totalRecords = records.length;

    // 5. 分组 + 聚合
    let stats: Record<string, unknown>;

    if (groupBy) {
      stats = computeGroupedStats(records, logType, groupBy, metrics);
    } else {
      stats = computeOverallStats(records, logType, metrics);
    }

    // 6. 构建响应
    const response: Record<string, unknown> = {
      stats,
      generatedAt: new Date().toISOString(),
      totalRecords,
    };

    // 附加解析警告
    if (parseErrors.length > 0) {
      response["_warnings"] = [
        `${parseErrors.length} line(s) in the log file failed to parse and were skipped`,
      ];
    }

    // 7. 返回
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(response),
        },
      ],
    };
  } catch (err: unknown) {
    console.error(`[log-stats] Internal error:`, err);
    return errorResult(
      "STATS_INTERNAL_ERROR",
      "An unexpected error occurred while computing log statistics"
    );
  }
}

// ── 分组统计 ──────────────────

function computeGroupedStats(
  records: Record<string, unknown>[],
  logType: string,
  groupBy: string,
  metrics: string
): Record<string, unknown> {
  const fieldMapping = GROUP_BY_FIELD_MAP[groupBy]?.[logType];
  if (!fieldMapping) {
    return { groups: {} };
  }

  // 按分组键收集记录
  const groups = new Map<string, Record<string, unknown>[]>();

  for (const record of records) {
    const keys = extractGroupKeys(record, fieldMapping);
    for (const key of keys) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(record);
    }
  }

  // 计算每组的 metrics
  const result: Record<string, Record<string, unknown>> = {};
  for (const [key, groupRecords] of groups) {
    result[key] = computeMetrics(groupRecords, metrics, logType);
  }

  return { groups: result };
}

/**
 * 提取记录中的分组键
 */
function extractGroupKeys(
  record: Record<string, unknown>,
  mapping: { type: string; name: string }
): string[] {
  if (mapping.type === "field") {
    const val = record[mapping.name];
    if (typeof val === "string") return [val];
    return [];
  }
  if (mapping.type === "arrayField") {
    const val = record[mapping.name];
    if (Array.isArray(val)) {
      return val.filter((v): v is string => typeof v === "string");
    }
    return [];
  }
  if (mapping.type === "special" && mapping.name === "agentScores") {
    // perf-reports: 从 agentScores[].agent 提取
    const scores = record["agentScores"];
    if (Array.isArray(scores)) {
      return scores
        .filter(
          (s): s is Record<string, unknown> =>
            typeof s === "object" && s !== null && typeof s["agent"] === "string"
        )
        .map((s) => s["agent"] as string);
    }
    return [];
  }
  return [];
}

// ── 整体统计（无 groupBy）──────────────

function computeOverallStats(
  records: Record<string, unknown>[],
  logType: string,
  metrics: string
): Record<string, unknown> {
  const result = computeMetrics(records, metrics, logType);
  return { overall: result };
}

// ── metrics 计算 ──────────────────

function computeMetrics(
  records: Record<string, unknown>[],
  metrics: string,
  logType: string
): Record<string, unknown> {
  const count = records.length;
  const result: Record<string, unknown> = { count };

  if (metrics === "rate") {
    result["rate"] = computeRate(records, logType);
  }

  if (metrics === "avg") {
    result["avg"] = computeAvg(records, logType);
  }

  return result;
}

/**
 * rate 计算规则（api-contract §4.5）：
 * - tasks: result=success 的比例
 * - agent-calls: accuracy=correct 的比例
 */
function computeRate(records: Record<string, unknown>[], logType: string): number {
  if (records.length === 0) return 0;

  let successCount = 0;
  if (logType === "tasks") {
    successCount = records.filter((r) => r["result"] === "success").length;
  } else if (logType === "agent-calls") {
    successCount = records.filter((r) => r["accuracy"] === "correct").length;
  } else {
    // 其他类型不支持 rate，返回 0
    return 0;
  }

  return Number((successCount / records.length).toFixed(4));
}

/**
 * avg 计算规则（api-contract §4.5）：
 * - tasks: duration 平均值
 * - appeals: score.total 平均值
 */
function computeAvg(records: Record<string, unknown>[], logType: string): number {
  if (records.length === 0) return 0;

  let sum = 0;
  let validCount = 0;

  if (logType === "tasks") {
    for (const r of records) {
      const d = r["duration"];
      if (typeof d === "number") {
        sum += d;
        validCount++;
      }
    }
  } else if (logType === "appeals") {
    for (const r of records) {
      const score = r["score"];
      if (typeof score === "object" && score !== null && "total" in score) {
        const total = (score as Record<string, unknown>)["total"];
        if (typeof total === "number") {
          sum += total;
          validCount++;
        }
      }
    }
  } else {
    return 0;
  }

  if (validCount === 0) return 0;
  return Number((sum / validCount).toFixed(2));
}
