# Log MCP Server

> **Structured logging for AI Agent teams via Model Context Protocol**
> 通过 MCP 协议为 AI 智能体团队提供结构化日志管理服务

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![MCP](https://img.shields.io/badge/MCP-Protocol-orange.svg)](https://modelcontextprotocol.io/)

---

## 🤔 Why?

当 AI Agent 团队（多个 AI 智能体协作）执行复杂项目时，面临一个共同痛点：**日志管理混乱**。

- 📝 日志散落在多个 Markdown 文件中，格式不统一
- 🔍 无法按时间、智能体、级别等条件快速检索
- 📊 统计和报告完全依赖人工整理，耗时且易出错
- ⏱️ 每次日志写入需要 1-3 分钟手动编辑文件

**Log MCP Server** 将这些问题一次性解决：通过 MCP 协议暴露 4 个标准 Tool，让 AI 智能体以结构化方式写入、查询、统计和渲染日志——**纯本地运行，不联网，零数据库依赖**。

| 指标 | Before | After |
|------|--------|-------|
| 日志写入时间 | 1-3 分钟 | < 5 秒 |
| 日志解析成功率 | ~70% | 100% |
| 报告生成 | 手动整理 | 一键自动 |

---

## ✨ Features

- **4 个 MCP Tool**：`log_write` / `log_query` / `log_stats` / `log_render`，覆盖日志全生命周期
- **8 种日志类型**：智能体调用、任务、违规、反馈、申诉、变更、绩效报告、质检动作
- **JSONL 存储**：append-only 写入，无数据库依赖，轻量且易备份
- **自动报告**：内置 3 个 Markdown 报告模板（运营聚合 / 绩效周报 / 违规汇总）
- **多维查询**：支持时间、智能体、级别、状态、关键词过滤 + 分页
- **聚合统计**：支持 count / rate / avg 三种统计方式 + groupBy 分组
- **广泛兼容**：支持所有 MCP 协议客户端（Claude Desktop、Cursor、Qoder 等）
- **纯本地运行**：stdio 通信（JSON-RPC 2.0），不暴露网络端口，数据完全离线

---

## 🚀 Quick Start

### Prerequisites

| 依赖 | 版本要求 |
|------|---------|
| Node.js | ≥ 18.0.0（需支持 ESM） |
| npm | ≥ 9.0 |

### Installation

```bash
git clone https://github.com/xjdxjd/log-mcp-server.git
cd log-mcp-server
npm install
npm run build
```

### MCP Configuration

将以下配置添加到你的 MCP 客户端配置文件中：

**通用配置模板**：

```json
{
  "mcpServers": {
    "log-mcp-server": {
      "command": "node",
      "args": ["/absolute/path/to/log-mcp-server/dist/index.js"],
      "env": {
        "LOG_DATA_DIR": "logs"
      }
    }
  }
}
```

**各客户端配置文件位置**：

| 客户端 | 配置文件路径 |
|--------|-------------|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Cursor | Settings → MCP → Add Server |
| Qoder | `.qoder/mcp.json`（项目级） |

> 💡 请将 `/absolute/path/to/` 替换为实际安装路径。`LOG_DATA_DIR` 控制数据文件存放目录（相对于工作目录）。

配置完成后重启客户端，确认 `log-mcp-server` 状态为 **connected** 即可。

---

## 🛠️ Tools

### `log_write` — 写入日志

将一条结构化日志写入对应的 JSONL 文件。Server 自动补充 `id`（UUID v4）、`timestamp`（ISO 8601）和 `_meta` 字段。

**输入**：

```json
{
  "logType": "agent-calls",
  "data": {
    "caller": "Solo Agent",
    "callee": "product-manager",
    "taskDesc": "编写 PRD 文档",
    "callReason": "主流程调度",
    "result": "完成 PRD 编写",
    "accuracy": "correct"
  }
}
```

**输出**：

```json
{
  "success": true,
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "logType": "agent-calls",
  "message": "Successfully wrote to agent-calls.jsonl"
}
```

### `log_query` — 条件查询

按时间、智能体、级别、关键词等条件过滤日志，支持分页。

**输入**：

```json
{
  "logType": "violations",
  "filters": {
    "timeRange": { "start": "2026-06-01T00:00:00Z", "end": "2026-06-08T23:59:59Z" },
    "level": "P0"
  },
  "limit": 20
}
```

**输出**：

```json
{
  "total": 2,
  "records": [
    { "id": "...", "timestamp": "2026-06-05T14:00:00Z", "level": "P0", "agent": "backend-engineer", "..." : "..." }
  ],
  "pagination": { "offset": 0, "count": 2, "limit": 20, "hasMore": false }
}
```

### `log_stats` — 聚合统计

对日志做分组统计，支持 count（计数）、rate（成功率）、avg（平均值）。

**输入**：

```json
{
  "logType": "tasks",
  "metrics": "rate",
  "groupBy": "agent"
}
```

**输出**：

```json
{
  "stats": {
    "groups": {
      "backend-engineer": { "count": 5, "rate": 0.8 },
      "frontend-engineer": { "count": 3, "rate": 1.0 }
    }
  },
  "generatedAt": "2026-06-09T10:00:00Z",
  "totalRecords": 8
}
```

### `log_render` — Markdown 报告渲染

基于日志数据自动生成 Markdown 报告，支持 3 种预设模板。不传 `data` 时自动从内部获取。

**输入**：

```json
{
  "template": "aggregator-report",
  "timeRange": { "start": "2026-06-01T00:00:00Z", "end": "2026-06-08T23:59:59Z" }
}
```

**输出**：

```json
{
  "markdown": "# 📊 运营聚合报告\n\n## 调用统计\n...",
  "template": "aggregator-report",
  "dataSource": "auto"
}
```

**可用模板**：

| 模板 | 说明 | 数据来源 |
|------|------|---------|
| `aggregator-report` | 运营聚合报告 | agent-calls + tasks + violations |
| `perf-weekly` | 绩效周报 | agent-calls + tasks + violations + feedback |
| `violation-summary` | 违规汇总 | violations |

---

## 📋 Log Types

| # | `logType` 值 | 用途 | 存储文件 |
|---|-------------|------|---------|
| 1 | `agent-calls` | 智能体之间的调用记录 | `agent-calls.jsonl` |
| 2 | `tasks` | 任务执行记录 | `tasks.jsonl` |
| 3 | `violations` | 违规记录（P0/P1/P2） | `violations.jsonl` |
| 4 | `feedback` | 用户或系统反馈 | `feedback.jsonl` |
| 5 | `appeals` | 违规申诉记录 | `appeals.jsonl` |
| 6 | `changes` | 代码/配置变更记录 | `changes.jsonl` |
| 7 | `perf-reports` | 智能体绩效评分报告 | `perf-reports.jsonl` |
| 8 | `inspector-actions` | 质检动作（检查/警告/处罚等） | `inspector-actions.jsonl` |

> 📖 每种类型的完整字段定义参见 [data-model-reference.md](./docs/data-model-reference.md)。

---

## ⚠️ Error Codes

所有错误通过 MCP `CallToolResult`（`isError: true`）返回，格式：

```json
{ "success": false, "errorCode": "WRITE_VALIDATION_FAILED", "message": "...", "details": [] }
```

| 错误码 | Tool | 说明 |
|--------|------|------|
| `WRITE_INVALID_LOG_TYPE` | log_write | 无效的日志类型 |
| `WRITE_VALIDATION_FAILED` | log_write | 数据校验失败（缺少必填字段） |
| `WRITE_FILE_ERROR` | log_write | 文件写入错误（磁盘满/权限不足） |
| `WRITE_LOCK_TIMEOUT` | log_write | 文件锁超时（预留） |
| `WRITE_INTERNAL_ERROR` | log_write | 内部错误 |
| `QUERY_INVALID_LOG_TYPE` | log_query | 无效日志类型 |
| `QUERY_INVALID_TIME_RANGE` | log_query | start 晚于 end |
| `QUERY_INVALID_PAGINATION` | log_query | limit/offset 超出范围 |
| `QUERY_FILE_READ_ERROR` | log_query | 文件读取异常 |
| `QUERY_PARSE_ERROR` | log_query | JSONL 文件严重损坏 |
| `QUERY_INTERNAL_ERROR` | log_query | 内部错误 |
| `STATS_INVALID_LOG_TYPE` | log_stats | 无效日志类型 |
| `STATS_INVALID_TIME_RANGE` | log_stats | start 晚于 end |
| `STATS_INVALID_GROUP_BY` | log_stats | groupBy 不适用于当前 logType |
| `STATS_INVALID_METRICS` | log_stats | metrics 不适用于当前 logType |
| `STATS_FILE_READ_ERROR` | log_stats | 文件读取异常 |
| `STATS_INTERNAL_ERROR` | log_stats | 内部错误 |
| `RENDER_INVALID_TEMPLATE` | log_render | 无效模板名称 |
| `RENDER_STATS_FAILED` | log_render | 统计数据获取失败 |
| `RENDER_INTERNAL_ERROR` | log_render | 渲染异常 |

---

## 📂 Project Structure

```
log-mcp-server/
├── package.json               # 项目配置
├── tsconfig.json              # TypeScript 配置
├── src/
│   ├── index.ts               # 入口：启动 MCP Server（stdio 模式）
│   ├── server.ts              # MCP 实例化 + 4 个 Tool 注册
│   ├── config.ts              # 配置：数据目录、常量
│   ├── types/
│   │   ├── index.ts           # 类型导出
│   │   └── models.ts          # 8 个数据模型 + 12 个枚举
│   ├── schemas/
│   │   ├── log-write.schema.ts   # log_write Zod Schema
│   │   ├── log-query.schema.ts   # log_query Zod Schema
│   │   ├── log-stats.schema.ts   # log_stats Zod Schema
│   │   └── log-render.schema.ts  # log_render Zod Schema
│   ├── tools/
│   │   ├── log-write.ts       # 日志写入
│   │   ├── log-query.ts       # 条件查询
│   │   ├── log-stats.ts       # 聚合统计
│   │   └── log-render.ts      # Markdown 渲染
│   └── utils/
│       ├── jsonl-store.ts     # JSONL 文件读写
│       └── time-filter.ts     # 时间过滤工具
└── dist/                      # 编译输出（tsc 生成）
```

运行时自动创建 `logs/` 目录，包含 8 个 JSONL 数据文件。

---

## 🔧 Development

```bash
# 编译 TypeScript
npm run build

# 启动 MCP Server（stdio 模式）
npm start

# 开发模式（监听文件变化自动编译）
npm run dev

# 类型检查（不生成输出文件）
npm run typecheck

# 运行 Markdown → JSONL 数据迁移脚本
npm run migrate
```

---

## ⚙️ Environment Variables

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `LOG_DATA_DIR` | 否 | `logs` | JSONL 数据文件存放目录（相对于 cwd） |

---

## 🏗️ Tech Stack

| 类别 | 技术 | 说明 |
|------|------|------|
| Runtime | Node.js ≥ 18 | ESM 模块模式 |
| Language | TypeScript 5.8 | 严格模式（`strict: true`） |
| MCP SDK | @modelcontextprotocol/sdk ^1.12.1 | stdio 通信（JSON-RPC 2.0） |
| Validation | Zod ^3.24.4 | 运行时输入校验 |
| Storage | JSONL files | append-only，无数据库依赖 |

---

## 🤝 Contributing

欢迎贡献！请遵循以下步骤：

1. **Fork** 本仓库
2. 创建你的特性分支：`git checkout -b feature/my-feature`
3. 提交更改：`git commit -m "feat: add my feature"`
4. 推送到分支：`git push origin feature/my-feature`
5. 发起 **Pull Request**

### Commit Convention

推荐使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
feat: 新功能
fix: 修复 bug
docs: 文档变更
refactor: 代码重构
chore: 构建/工具变更
```

---

## 📄 License

[Apache License 2.0](./LICENSE) — 允许商业使用、修改和分发，需保留版权声明和许可证副本。
