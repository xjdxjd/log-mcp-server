// ========================================
// 数据模型定义 — 来自 data-model.md v1.0.0
// ========================================

// ── 通用字段 ──────────────────────────

export interface LogMeta {
  version: number;
  createdAt: string;
  writtenBy?: string;
}

export interface BaseLogEntry {
  id: string;
  timestamp: string;
  source: string;
  _meta: LogMeta;
}

// ── 枚举 / 类型别名 (12个) ──────────────

export type LogType =
  | "agent-calls"
  | "tasks"
  | "violations"
  | "feedback"
  | "appeals"
  | "changes"
  | "perf-reports"
  | "inspector-actions";

export type CallAccuracy = "correct" | "inaccurate" | "pending";

export type TaskType =
  | "requirement-analysis"
  | "architecture-design"
  | "frontend-dev"
  | "backend-dev"
  | "testing"
  | "code-review"
  | "security-review"
  | "deployment"
  | "documentation"
  | "project-planning"
  | "data-migration"
  | "other";

export type TaskResult = "success" | "failed" | "partial" | "in-progress";

export type ViolationLevel = "P0" | "P1" | "P2";

export type ViolationStatus = "pending" | "corrected" | "closed";

export type FeedbackRating = "positive" | "warning" | "negative";

export type FeedbackStatus = "pending" | "improved" | "closed";

export type AppealResult = "approved" | "partial" | "rejected";

export type ChangeType = "major" | "feature" | "bugfix";

export type ChangeStatus = "pending" | "completed" | "rolled-back";

export type InspectorActionType =
  | "inspect"
  | "warn"
  | "penalize"
  | "promote"
  | "demote"
  | "eliminate";

// ── 8 个数据模型 ──────────────────────

/** 5.1 智能体调用记录 */
export interface AgentCallRecord extends BaseLogEntry {
  caller: string;
  callee: string;
  taskDesc: string;
  callReason: string;
  result: string;
  accuracy: CallAccuracy;
  notes?: string;
  taskId?: string;
}

/** 5.2 任务记录 */
export interface TaskRecord extends BaseLogEntry {
  type: TaskType;
  agents: string[];
  startTime: string;
  endTime?: string;
  duration?: number;
  result: TaskResult;
  violations: string[];
  description?: string;
  notes?: string;
}

/** 5.3 违规记录 */
export interface ViolationRecord extends BaseLogEntry {
  level: ViolationLevel;
  content: string;
  basis: string;
  action: string;
  status: ViolationStatus;
  agent: string;
  notes?: string;
}

/** 5.4 反馈记录 */
export interface FeedbackRecord extends BaseLogEntry {
  taskSummary: string;
  rating: FeedbackRating;
  content: string;
  improvement?: string;
  status: FeedbackStatus;
}

/** 5.5 申诉评分 */
export interface AppealScore {
  judgmentAccuracy: number;
  contextCompleteness: number;
  ruleClarity: number;
  reasonableness: number;
  total: number;
}

/** 5.5 申诉记录 */
export interface AppealRecord extends BaseLogEntry {
  appellant: string;
  violationId: string;
  level: ViolationLevel;
  reason: string;
  evidence: string[];
  score: AppealScore;
  result: AppealResult;
  action?: string;
  handler?: string;
  feedback?: string;
}

/** 5.6 变更记录 */
export interface ChangeRecord extends BaseLogEntry {
  version: string;
  changeType: ChangeType;
  files: string[];
  description: string;
  reason?: string;
  impact?: string;
  rollbackPlan?: string;
  responsible: string;
  status: ChangeStatus;
  notes?: string;
}

/** 5.7 智能体评分 */
export interface AgentScore {
  agent: string;
  totalScore: number;
  dimensions: {
    taskCompletionRate: number;
    violationPenalty: number;
    userSatisfaction: number;
    responseEfficiency: number;
    collaborationQuality: number;
  };
  rank: number;
}

export interface RankingEntry {
  rank: number;
  agent: string;
  score: number;
}

export interface EliminationInfo {
  agent: string;
  reason: string;
  date: string;
}

/** 5.7 绩效报告记录 */
export interface PerfReportRecord extends BaseLogEntry {
  period: string;
  periodStart: string;
  periodEnd: string;
  agentScores: AgentScore[];
  rankings: RankingEntry[];
  elimination?: EliminationInfo;
  summary?: string;
}

/** 5.8 质检动作记录 */
export interface InspectorActionRecord extends BaseLogEntry {
  action: InspectorActionType;
  target: string;
  reason: string;
  result: string;
  violationId?: string;
  appealId?: string;
  perfReportId?: string;
  notes?: string;
}

// ── 联合类型 ──────────────────────────

export type LogRecord =
  | AgentCallRecord
  | TaskRecord
  | ViolationRecord
  | FeedbackRecord
  | AppealRecord
  | ChangeRecord
  | PerfReportRecord
  | InspectorActionRecord;

/** LogType → Record Interface 映射 */
export interface LogTypeMap {
  "agent-calls": AgentCallRecord;
  "tasks": TaskRecord;
  "violations": ViolationRecord;
  "feedback": FeedbackRecord;
  "appeals": AppealRecord;
  "changes": ChangeRecord;
  "perf-reports": PerfReportRecord;
  "inspector-actions": InspectorActionRecord;
}

/** 所有有效的 LogType 值 */
export const LOG_TYPES: LogType[] = [
  "agent-calls",
  "tasks",
  "violations",
  "feedback",
  "appeals",
  "changes",
  "perf-reports",
  "inspector-actions",
];
