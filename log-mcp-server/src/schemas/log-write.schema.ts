/**
 * log_write 输入校验 Schema
 * 来自 api-contract.md §2.1
 */
import { z } from "zod";

/** 8 种 LogType 枚举 */
export const LogTypeEnum = z.enum([
  "agent-calls",
  "tasks",
  "violations",
  "feedback",
  "appeals",
  "changes",
  "perf-reports",
  "inspector-actions",
]);

// ── 各 logType 的数据校验 Schema ──────

const AgentCallDataSchema = z.object({
  caller: z.string().max(200),
  callee: z.string().max(200),
  taskDesc: z.string().max(5000),
  callReason: z.string().max(5000),
  result: z.string().max(200),
  accuracy: z.enum(["correct", "inaccurate", "pending"]),
  notes: z.string().max(5000).optional(),
  taskId: z.string().max(200).optional(),
  source: z.string().max(200).optional(),
});

const TaskDataSchema = z.object({
  type: z.enum([
    "requirement-analysis", "architecture-design", "frontend-dev",
    "backend-dev", "testing", "code-review", "security-review",
    "deployment", "documentation", "project-planning", "data-migration", "other",
  ]),
  agents: z.array(z.string().max(200)).min(1),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }).optional(),
  duration: z.number().optional(),
  result: z.enum(["success", "failed", "partial", "in-progress"]),
  violations: z.array(z.string().max(200)),
  description: z.string().max(5000).optional(),
  notes: z.string().max(5000).optional(),
  source: z.string().max(200).optional(),
}).refine(
  (d) => {
    if (d.result === "in-progress") return !d.endTime && d.duration === undefined;
    return true;
  },
  { message: "in-progress tasks must not have endTime or duration" }
);

const ViolationDataSchema = z.object({
  level: z.enum(["P0", "P1", "P2"]),
  content: z.string().max(5000),
  basis: z.string().max(5000),
  action: z.string().max(5000),
  status: z.enum(["pending", "corrected", "closed"]),
  agent: z.string().max(200),
  notes: z.string().max(5000).optional(),
  source: z.string().max(200).optional(),
});

const FeedbackDataSchema = z.object({
  taskSummary: z.string().max(5000),
  rating: z.enum(["positive", "warning", "negative"]),
  content: z.string().max(5000),
  improvement: z.string().max(5000).optional(),
  status: z.enum(["pending", "improved", "closed"]),
  source: z.string().max(200).optional(),
});

const AppealScoreSchema = z.object({
  judgmentAccuracy: z.number().min(0).max(30),
  contextCompleteness: z.number().min(0).max(25),
  ruleClarity: z.number().min(0).max(25),
  reasonableness: z.number().min(0).max(20),
  total: z.number().min(0).max(100),
}).refine(
  (s) => s.total === s.judgmentAccuracy + s.contextCompleteness + s.ruleClarity + s.reasonableness,
  { message: "total must equal sum of four dimensions", path: ["total"] }
);

const AppealDataSchema = z.object({
  appellant: z.string().max(200),
  violationId: z.string().max(200),
  level: z.enum(["P0", "P1", "P2"]),
  reason: z.string().max(5000),
  evidence: z.array(z.string().max(5000)).min(1),
  score: AppealScoreSchema,
  result: z.enum(["approved", "partial", "rejected"]),
  action: z.string().max(5000).optional(),
  handler: z.string().max(200).optional(),
  feedback: z.string().max(5000).optional(),
  source: z.string().max(200).optional(),
});

const ChangeDataSchema = z.object({
  version: z.string().max(200),
  changeType: z.enum(["major", "feature", "bugfix"]),
  files: z.array(z.string().max(500)).min(1),
  description: z.string().max(5000),
  reason: z.string().max(5000).optional(),
  impact: z.string().max(5000).optional(),
  rollbackPlan: z.string().max(5000).optional(),
  responsible: z.string().max(200),
  status: z.enum(["pending", "completed", "rolled-back"]),
  notes: z.string().max(5000).optional(),
  source: z.string().max(200).optional(),
});

const AgentScoreSchema = z.object({
  agent: z.string().max(200),
  totalScore: z.number().min(0).max(100),
  dimensions: z.object({
    taskCompletionRate: z.number(),
    violationPenalty: z.number(),
    userSatisfaction: z.number(),
    responseEfficiency: z.number(),
    collaborationQuality: z.number(),
  }),
  rank: z.number().int().min(1),
});

const RankingEntrySchema = z.object({
  rank: z.number().int(),
  agent: z.string().max(200),
  score: z.number(),
});

const EliminationInfoSchema = z.object({
  agent: z.string().max(200),
  reason: z.string().max(5000),
  date: z.string().max(200),
});

const PerfReportDataSchema = z.object({
  period: z.string().max(200),
  periodStart: z.string().datetime({ offset: true }),
  periodEnd: z.string().datetime({ offset: true }),
  agentScores: z.array(AgentScoreSchema),
  rankings: z.array(RankingEntrySchema),
  elimination: EliminationInfoSchema.optional(),
  summary: z.string().max(5000).optional(),
  source: z.string().max(200).optional(),
});

const InspectorActionDataSchema = z.object({
  action: z.enum(["inspect", "warn", "penalize", "promote", "demote", "eliminate"]),
  target: z.string().max(200),
  reason: z.string().max(5000),
  result: z.string().max(200),
  violationId: z.string().max(200).optional(),
  appealId: z.string().max(200).optional(),
  perfReportId: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
  source: z.string().max(200).optional(),
});

/** logType → 数据 Schema 映射 */
export const LOG_TYPE_SCHEMAS: Record<string, z.ZodTypeAny> = {
  "agent-calls": AgentCallDataSchema,
  "tasks": TaskDataSchema,
  "violations": ViolationDataSchema,
  "feedback": FeedbackDataSchema,
  "appeals": AppealDataSchema,
  "changes": ChangeDataSchema,
  "perf-reports": PerfReportDataSchema,
  "inspector-actions": InspectorActionDataSchema,
};

/** log_write 输入 Schema（raw shape for MCP tool registration） */
export const logWriteInputShape = {
  logType: LogTypeEnum,
  data: z.record(z.string(), z.unknown()),
};
