/**
 * log_render 输入校验 Schema
 * 来自 api-contract.md §5.1
 */
import { z } from "zod";

/** log_render 输入 Schema（raw shape for MCP tool registration） */
export const logRenderInputShape = {
  template: z.enum(["aggregator-report", "perf-weekly", "violation-summary"]),
  data: z.record(z.string(), z.unknown()).optional(),
  timeRange: z.object({
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
  }).optional(),
};
