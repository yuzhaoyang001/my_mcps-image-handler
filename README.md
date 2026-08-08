# images-handler

给只支持文本的模型(如 **DeepSeek**)补上"看图"能力的标准 MCP 服务。

DeepSeek 不能直接识别图片,但本服务通过 [Cursor TypeScript SDK](https://cursor.com/docs/sdk/typescript) 在本机跑一个 Cursor agent(默认 `composer-2`,可换 Claude/GPT 视觉模型),把图片理解成文本描述返回。DeepSeek 调用工具拿到文字结果,就等于"能看图"了。

同时它也是**通用 agent 工具**:指令 + 可选图片,可执行任意任务。

## 前置条件

- Node.js ≥ 22.13
- Cursor 凭据(二选一):
  - 设置环境变量 `CURSOR_API_KEY`,或
  - 已用 `Cursor.auth.login()` 登录过 Cursor 账号(SDK 自动读取存储的凭据)

## 安装与运行

```bash
npm install
npm start            # 开发运行(stdio),等价 npx tsx src/index.ts
# 或构建后运行
npm run build && node dist/index.js
```

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `CURSOR_API_KEY` | — | Cursor API key,缺省时回退登录态 |
| `CURSOR_MODEL` | `composer-2` | 视觉/agent 模型 id |
| `CURSOR_AGENT_TIMEOUT_MS` | `600000` | 单次 agent 调用超时(毫秒) |

## 接入客户端

### Claude Code

```bash
claude mcp add cursor-agent -- npx tsx D:/path/to/images-handler/src/index.ts
```

### Cursor

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "cursor-agent": {
      "command": "npx",
      "args": ["tsx", "D:/path/to/images-handler/src/index.ts"]
    }
  }
}
```

### 其他标准 MCP 客户端

stdio 传输,按标准协议配置启动命令即可。

## 工具:`cursor_agent`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `instruction` | string | 是 | 要 agent 做什么。看图时例如"详细描述这张图片的内容" |
| `images` | string 或 string[] | 否 | 图片 data URI(`data:image/png;base64,...`)或 http(s) URL |
| `model` | string | 否 | 覆盖默认模型 |
| `tools` | boolean | 否 | `true` 时 agent 可执行 shell/文件工具(通用 agent 模式)。默认 `false` —— agent 只纯文本应答、不执行任何工具(看图安全模式) |
| `cwd` | string | 否 | agent 的**初始**工作目录(仅在启用 tools 时有意义),默认服务所在目录 |

## 示例

给 DeepSeek 看图(默认就是安全模式,`tools` 可省略):

```json
{
  "instruction": "详细描述这张图片的内容",
  "images": ["data:image/png;base64,iVBORw0KGgo..."]
}
```

当通用 agent 用:

```json
{
  "instruction": "读取当前目录的 package.json 并总结依赖",
  "cwd": "D:/work/project/my-mcps"
}
```

## 说明与限制

- 每次工具调用都会新建一个独立 Cursor agent(调用间不共享会话历史),用完即关闭。
- **安全边界**:`cwd` 只是 agent 的初始工作目录,**不是沙箱**。当 `tools: true` 时,agent 拥有以服务进程用户身份执行任意 shell 命令、读写任意路径文件的能力;且 agent 会自行抓取传入的图片 URL。默认 `tools: false`(纯文本应答)避免把不可信图片内容暴露给高权限 agent。**只在信任调用方时才开 `tools: true`。**
