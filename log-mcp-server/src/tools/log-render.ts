/**
 * log_render — Markdown 渲染 Tool
 * 3 个模板：aggregator-report / perf-weekly / violation-summary
 */
import { getLogFilePath } from "../config.js";
import { readAll, fileExists } from "../utils/jsonl-store.js";
import { createTimeFilter, isValidTimeRange, type TimeRange } from "../utils/time-filter.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** 模板枚举 */
type TemplateType = "aggregator-report" | "perf-weekly" | "violation-summary";

/** Tool handler 入参类型 */
interface LogRenderArgs {
  template: TemplateType;
  data?: Record<string, unknown>;
  timeRange?: { start: string; end: string };
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
 * log_render 主处理函数
 */
export async function handleLogRender(args: LogRenderArgs): Promise<CallToolResult> {
  try {
    const { template, timeRange } = args;

    // 1. 校验时间范围
    if (timeRange && !isValidTimeRange(timeRange as TimeRange)) {
      return errorResult(
        "RENDER_STATS_FAILED",
        "Invalid time range: start must be before or equal to end"
      );
    }

    // 2. 自动获取数据（如果 data 未传入）
    const tr = timeRange as TimeRange | undefined;

    let markdown: string;

    switch (template) {
      case "aggregator-report":
        markdown = await renderAggregatorReport(tr);
        break;
      case "perf-weekly":
        markdown = await renderPerfWeekly(tr);
        break;
      case "violation-summary":
        markdown = await renderViolationSummary(tr);
        break;
      default:
        return errorResult(
          "RENDER_INVALID_TEMPLATE",
          `Invalid template: ${template}. Must be one of: aggregator-report, perf-weekly, violation-summary`
        );
    }

    // 3. 返回
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            markdown,
            template,
            dataSource: "auto",
          }),
        },
      ],
    };
  } catch (err: unknown) {
    console.error(`[log-render] Internal error:`, err);
    return errorResult(
      "RENDER_INTERNAL_ERROR",
      "An unexpected error occurred while rendering the report"
    );
  }
}

// ════════════════════════════════════════
//  模板渲染实现
// ════════════════════════════════════════

/**
 * 辅助：读取指定 logType 的记录，可选时间过滤
 * 返回记录数组，解析错误记录到 stderr
 */
async function loadRecords(
  logType: string,
  timeRange?: TimeRange
): Promise<Record<string, unknown>[]> {
  const filePath = getLogFilePath(logType);
  const exists = await fileExists(filePath);
  if (!exists) return [];

  const readResult = await readAll(filePath);
  if (readResult.parseErrors.length > 0) {
    console.error(
      `[log-render] ${readResult.parseErrors.length} line(s) failed to parse in ${logType}.jsonl`
    );
  }
  let records = readResult.records;
  if (timeRange) {
    records = records.filter(createTimeFilter(timeRange));
  }
  return records;
}

/**
 * 辅助：按字段值分组计数
 */
function countBy(
  records: Record<string, unknown>[],
  field: string
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of records) {
    const val = r[field];
    const key = typeof val === "string" ? val : "(unknown)";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

// ── 模板 1：aggregator-report ─────────────

async function renderAggregatorReport(timeRange?: TimeRange): Promise<string> {
  const [calls, tasks, violations] = await Promise.all([
    loadRecords("agent-calls", timeRange),
    loadRecords("tasks", timeRange),
    loadRecords("violations", timeRange),
  ]);

  const totalRecords = calls.length + tasks.length + violations.length;
  if (totalRecords === 0) {
    return "📭 当前无日志数据\n\n请先通过 log_write 写入相关日志。";
  }

  const lines: string[] = [];
  const period = timeRange
    ? `${timeRange.start.slice(0, 10)} ~ ${timeRange.end.slice(0, 10)}`
    : "全部时间";

  lines.push(`# 📊 运营聚合报告`);
  lines.push("");
  lines.push(`> 统计周期：${period}  `);
  lines.push(`> 生成时间：${new Date().toISOString().slice(0, 19).replace("T", " ")}`);
  lines.push("");

  // 调用统计
  if (calls.length > 0) {
    lines.push(`## 📞 智能体调用（共 ${calls.length} 次）`);
    lines.push("");
    const callerCounts = countBy(calls, "caller");
    lines.push("| 调用者 | 次数 |");
    lines.push("|--------|------|");
    for (const [agent, count] of Object.entries(callerCounts).sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${agent} | ${count} |`);
    }
    lines.push("");
  }

  // 任务统计
  if (tasks.length > 0) {
    lines.push(`## 📋 任务统计（共 ${tasks.length} 个）`);
    lines.push("");
    const typeCounts = countBy(tasks, "type");
    lines.push("### 按类型分布");
    lines.push("");
    lines.push("| 类型 | 数量 |");
    lines.push("|------|------|");
    for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${type} | ${count} |`);
    }
    lines.push("");

    const successCount = tasks.filter((t) => t["result"] === "success").length;
    const rate = tasks.length > 0 ? ((successCount / tasks.length) * 100).toFixed(1) : "0.0";
    lines.push(`### 任务成功率：${rate}%（${successCount}/${tasks.length}）`);
    lines.push("");
  }

  // 违规统计
  if (violations.length > 0) {
    lines.push(`## ⚠️ 违规统计（共 ${violations.length} 条）`);
    lines.push("");
    const levelCounts = countBy(violations, "level");
    lines.push("### 按级别分布");
    lines.push("");
    for (const level of ["P0", "P1", "P2"]) {
      const count = levelCounts[level] ?? 0;
      const emoji = level === "P0" ? "🔴" : level === "P1" ? "🟡" : "🟢";
      lines.push(`- ${emoji} ${level}: ${count} 条`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── 模板 2：perf-weekly ─────────────

async function renderPerfWeekly(timeRange?: TimeRange): Promise<string> {
  const [calls, tasks, violations, feedback] = await Promise.all([
    loadRecords("agent-calls", timeRange),
    loadRecords("tasks", timeRange),
    loadRecords("violations", timeRange),
    loadRecords("feedback", timeRange),
  ]);

  const totalRecords = calls.length + tasks.length + violations.length + feedback.length;
  if (totalRecords === 0) {
    return "📭 当前无日志数据\n\n请先通过 log_write 写入相关日志。";
  }

  const lines: string[] = [];
  const period = timeRange
    ? `${timeRange.start.slice(0, 10)} ~ ${timeRange.end.slice(0, 10)}`
    : "全部时间";

  lines.push(`# 🏆 绩效周报`);
  lines.push("");
  lines.push(`> 统计周期：${period}  `);
  lines.push(`> 生成时间：${new Date().toISOString().slice(0, 19).replace("T", " ")}`);
  lines.push("");

  // 收集所有出现的智能体名称
  const agents = new Set<string>();
  for (const c of calls) {
    if (typeof c["callee"] === "string") agents.add(c["callee"] as string);
    if (typeof c["caller"] === "string") agents.add(c["caller"] as string);
  }
  for (const t of tasks) {
    const arr = t["agents"];
    if (Array.isArray(arr)) {
      for (const a of arr) {
        if (typeof a === "string") agents.add(a);
      }
    }
  }
  for (const v of violations) {
    if (typeof v["agent"] === "string") agents.add(v["agent"] as string);
  }

  if (agents.size === 0) {
    return "📭 当前无日志数据\n\n请先通过 log_write 写入相关日志。";
  }

  // 五维评分计算
  lines.push("## 五维评分");
  lines.push("");
  lines.push("| 智能体 | 调用准确率 | 任务成功率 | 违规扣分 | 用户满意度 | 综合评分 |");
  lines.push("|--------|-----------|-----------|---------|-----------|---------|");

  for (const agent of [...agents].sort()) {
    // 调用准确率
    const agentCalls = calls.filter(
      (c) => c["callee"] === agent || c["caller"] === agent
    );
    const correctCalls = agentCalls.filter((c) => c["accuracy"] === "correct").length;
    const callAccuracy = agentCalls.length > 0
      ? ((correctCalls / agentCalls.length) * 100).toFixed(1)
      : "-";

    // 任务成功率
    const agentTasks = tasks.filter((t) => {
      const arr = t["agents"];
      return Array.isArray(arr) && arr.includes(agent);
    });
    const successTasks = agentTasks.filter((t) => t["result"] === "success").length;
    const taskRate = agentTasks.length > 0
      ? ((successTasks / agentTasks.length) * 100).toFixed(1)
      : "-";

    // 违规数
    const agentViolations = violations.filter((v) => v["agent"] === agent);
    const violationCount = agentViolations.length;

    // 用户满意度（反馈）
    const agentFeedback = feedback.filter((f) => f["source"] === agent);
    const positiveFeedback = agentFeedback.filter((f) => f["rating"] === "positive").length;
    const satisfaction = agentFeedback.length > 0
      ? ((positiveFeedback / agentFeedback.length) * 100).toFixed(1)
      : "-";

    // 综合评分（简化版：满分 100）
    const callScore = agentCalls.length > 0 ? (correctCalls / agentCalls.length) * 25 : 0;
    const taskScore = agentTasks.length > 0 ? (successTasks / agentTasks.length) * 25 : 0;
    const violationPenalty = Math.min(violationCount * 5, 25);
    const feedScore = agentFeedback.length > 0 ? (positiveFeedback / agentFeedback.length) * 25 : 0;
    const totalScore = Math.max(0, Math.round(callScore + taskScore - violationPenalty + feedScore));

    lines.push(
      `| ${agent} | ${callAccuracy}${agentCalls.length > 0 ? "%" : ""} | ${taskRate}${agentTasks.length > 0 ? "%" : ""} | ${violationCount} | ${satisfaction}${agentFeedback.length > 0 ? "%" : ""} | ${totalScore} |`
    );
  }
  lines.push("");

  // 数据概要
  lines.push("## 数据概要");
  lines.push("");
  lines.push(`- 📞 调用记录：${calls.length} 条`);
  lines.push(`- 📋 任务记录：${tasks.length} 条`);
  lines.push(`- ⚠️ 违规记录：${violations.length} 条`);
  lines.push(`- 💬 反馈记录：${feedback.length} 条`);
  lines.push("");

  return lines.join("\n");
}

// ── 模板 3：violation-summary ─────────────

async function renderViolationSummary(timeRange?: TimeRange): Promise<string> {
  const violations = await loadRecords("violations", timeRange);

  if (violations.length === 0) {
    return "📭 当前无日志数据\n\n请先通过 log_write 写入相关日志。";
  }

  const lines: string[] = [];
  const period = timeRange
    ? `${timeRange.start.slice(0, 10)} ~ ${timeRange.end.slice(0, 10)}`
    : "全部时间";

  lines.push(`# ⚠️ 违规汇总`);
  lines.push("");
  lines.push(`> 统计周期：${period}  `);
  lines.push(`> 生成时间：${new Date().toISOString().slice(0, 19).replace("T", " ")}`);
  lines.push("");

  // 按级别统计
  lines.push("## 按级别分布");
  lines.push("");
  const levelCounts = countBy(violations, "level");
  for (const level of ["P0", "P1", "P2"]) {
    const count = levelCounts[level] ?? 0;
    const emoji = level === "P0" ? "🔴" : level === "P1" ? "🟡" : "🟢";
    lines.push(`- ${emoji} ${level}: ${count} 条`);
  }
  lines.push("");

  // 按智能体统计
  lines.push("## 按智能体分布");
  lines.push("");
  const agentCounts = countBy(violations, "agent");
  lines.push("| 智能体 | P0 | P1 | P2 | 合计 |");
  lines.push("|--------|-----|-----|-----|------|");
  for (const [agent, total] of Object.entries(agentCounts).sort((a, b) => b[1] - a[1])) {
    const agentVs = violations.filter((v) => v["agent"] === agent);
    const p0 = agentVs.filter((v) => v["level"] === "P0").length;
    const p1 = agentVs.filter((v) => v["level"] === "P1").length;
    const p2 = agentVs.filter((v) => v["level"] === "P2").length;
    lines.push(`| ${agent} | ${p0} | ${p1} | ${p2} | ${total} |`);
  }
  lines.push("");

  // 待处理列表
  const pending = violations.filter((v) => v["status"] === "pending");
  if (pending.length > 0) {
    lines.push(`## 📌 待处理违规（${pending.length} 条）`);
    lines.push("");
    lines.push("| 级别 | 智能体 | 内容 | 状态 |");
    lines.push("|------|--------|------|------|");
    for (const v of pending) {
      const level = v["level"] ?? "?";
      const agent = v["agent"] ?? "?";
      const content = typeof v["content"] === "string"
        ? (v["content"] as string).slice(0, 50)
        : "?";
      lines.push(`| ${level} | ${agent} | ${content} | pending |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
