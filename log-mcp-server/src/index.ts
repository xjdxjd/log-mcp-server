/**
 * 入口文件 — 启动 MCP Server（stdio 模式）
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // 输出到 stderr（stdout 保留给 JSON-RPC 通信）
  console.error(
    `[${new Date().toISOString()}] log-mcp-server v1.0.0 started (stdio mode)`
  );
}

main().catch((err) => {
  console.error("[log-mcp-server] Fatal error:", err);
  process.exit(1);
});
