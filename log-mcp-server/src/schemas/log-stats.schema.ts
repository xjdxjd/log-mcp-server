/**
 * log_stats 输入校验 Schema
 * 来自 api-contract.md §4.1
 */
import { z } from "zod";

/** log_stats 输入 Schema（raw shape for MCP tool registration） */
export const logStatsInputShape = {
  logType: z.enum([
    "agent-calls", "tasks", "violations", "feedback",
    "appeals", "changes", "perf-reports", "inspector-actions",
  ]),
  timeRange: z.object({
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
  }).optional(),
  groupBy: z.enum(["agent", "level", "type", "status", "result"]).optional(),
  metrics: z.enum(["count", "rate", "avg"]).default("count").optional(),
};
