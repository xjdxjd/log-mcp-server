/**
 * MCP Server 实例化 + Tool 注册
 * 将 4 个 MCP Tool 注册到 McpServer 实例
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SERVER_NAME, SERVER_VERSION } from "./config.js";
import { logWriteInputShape } from "./schemas/log-write.schema.js";
import { logQueryInputShape } from "./schemas/log-query.schema.js";
import { logStatsInputShape } from "./schemas/log-stats.schema.js";
import { logRenderInputShape } from "./schemas/log-render.schema.js";
import { handleLogWrite } from "./tools/log-write.js";
import { handleLogQuery } from "./tools/log-query.js";
import { handleLogStats } from "./tools/log-stats.js";
import { handleLogRender } from "./tools/log-render.js";

/**
 * 创建并配置 MCP Server 实例
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // ── 注册 log_write ──────────────
  server.tool(
    "log_write",
    "写入日志记录到 JSONL 文件",
    logWriteInputShape,
    async (args) => {
      return handleLogWrite(args as Parameters<typeof handleLogWrite>[0]);
    }
  );

  // ── 注册 log_query ──────────────
  server.tool(
    "log_query",
    "按条件查询日志记录",
    logQueryInputShape,
    async (args) => {
      return handleLogQuery(args as Parameters<typeof handleLogQuery>[0]);
    }
  );

  // ── 注册 log_stats ──────────────
  server.tool(
    "log_stats",
    "聚合统计日志数据",
    logStatsInputShape,
    async (args) => {
      return handleLogStats(args as Parameters<typeof handleLogStats>[0]);
    }
  );

  // ── 注册 log_render ──────────────
  server.tool(
    "log_render",
    "渲染 Markdown 报告",
    logRenderInputShape,
    async (args) => {
      return handleLogRender(args as Parameters<typeof handleLogRender>[0]);
    }
  );

  return server;
}
