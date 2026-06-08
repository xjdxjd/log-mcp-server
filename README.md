# 日志自动化 MCP Server

> 基于 MCP（Model Context Protocol）的本地日志管理服务，通过 stdio 模式与 Qoder IDE AI 智能体通信，提供结构化日志的写入、查询、统计和渲染能力。**纯本地运行，不联网。**

---

## 项目结构

```
backend/
├── .gitignore
└── log-mcp-server/            # MCP Server 主项目
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts           # 入口：启动 MCP Server（stdio 模式）
    │   ├── server.ts          # MCP 实例化 + 4 个 Tool 注册
    │   ├── config.ts          # 配置：数据目录路径、常量
    │   ├── types/             # 8 个数据模型 + 12 个枚举类型
    │   ├── schemas/           # 4 个 Tool 的 Zod 输入校验
    │   ├── tools/             # 4 个 Tool 的业务实现
    │   └── utils/             # JSONL 读写、时间过滤工具
    └── dist/                  # tsc 编译输出
```

运行时会自动创建 `logs/` 数据目录，包含 8 个 JSONL 文件（agent-calls、tasks、violations、feedback、appeals、changes、perf-reports、inspector-actions）。

---

## 快速开始

### 前置条件

- **Node.js** ≥ 18.0.0（需支持 ESM）
- **npm** ≥ 9.0

### 安装 & 编译

```bash
cd log-mcp-server
npm install
npm run build
```

### 注册 MCP Server

将以下配置合并到 Qoder IDE 的 `.qoder/mcp.json`：

```json
{
  "mcpServers": {
    "log-mcp-server": {
      "command": "node",
      "args": ["backend/log-mcp-server/dist/index.js"],
      "cwd": "${workspace}",
      "env": {
        "LOG_DATA_DIR": "logs"
      }
    }
  }
}
```

> `${workspace}` 为 Qoder IDE 的工作目录占位符，IDE 会自动替换。

注册后重启/重新加载 IDE，在 MCP 工具面板确认 `log-mcp-server` 状态为 **connected** 即可。

---

## MCP Tool 概览

| Tool | 功能 | 说明 |
|------|------|------|
| `log_write` | 日志写入 | 写入一条结构化日志到对应 JSONL 文件，支持 8 种日志类型，自动补充 `id`、`timestamp`、`_meta` |
| `log_query` | 条件查询 | 按时间、智能体、级别、关键词等条件查询日志，支持分页 |
| `log_stats` | 聚合统计 | 对日志做分组统计，支持 count（计数）、rate（成功率）、avg（平均值） |
| `log_render` | Markdown 渲染 | 基于日志数据自动生成 Markdown 报告，支持 3 种预设模板 |

---

## 开发命令

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

## 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `LOG_DATA_DIR` | 否 | `logs` | JSONL 数据文件存放目录（相对于 cwd） |

---

## 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 运行时 | Node.js ≥ 18 | ESM 模块模式 |
| 语言 | TypeScript 5.8 | 严格模式 |
| MCP SDK | @modelcontextprotocol/sdk ^1.12.1 | stdio 通信（JSON-RPC 2.0） |
| 校验 | Zod ^3.24.4 | 运行时输入校验 |
| 存储 | JSONL 文件 | append-only，无数据库依赖 |

---

## 许可证

MIT
