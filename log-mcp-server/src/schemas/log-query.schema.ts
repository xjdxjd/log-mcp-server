/**
 * log_query 输入校验 Schema
 * 来自 api-contract.md §3.1
 */
import { z } from "zod";

/** log_query 输入 Schema（raw shape for MCP tool registration） */
export const logQueryInputShape = {
  logType: z.enum([
    "agent-calls", "tasks", "violations", "feedback",
    "appeals", "changes", "perf-reports", "inspector-actions",
  ]),
  filters: z.object({
    timeRange: z.object({
      start: z.string().datetime({ offset: true }),
      end: z.string().datetime({ offset: true }),
    }).optional(),
    agent: z.string().max(200).optional(),
    level: z.enum(["P0", "P1", "P2"]).optional(),
    status: z.string().max(200).optional(),
    result: z.string().max(200).optional(),
    keyword: z.string().max(500).optional(),
  }).optional(),
  limit: z.number().int().min(1).max(200).default(50).optional(),
  offset: z.number().int().min(0).default(0).optional(),
};
