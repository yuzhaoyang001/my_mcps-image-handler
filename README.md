# images-handler

给只支持文本的模型(如 **DeepSeek**)补上"看图"能力的标准 MCP 服务。

DeepSeek 不能直接识别图片,但本服务通过 [Cursor TypeScript SDK](https://cursor.com/docs/sdk/typescript) 在本机跑一个 Cursor agent(默认 `composer-2`,可换 Claude/GPT 视觉模型),把图片理解成文本描述返回。DeepSeek 调用工具拿到文字结果,就等于"能看图"了。

本服务**只做图片识别**:agent 始终以纯文本模式运行,不执行任何 shell/文件工具。

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
| `CURSOR_MODEL` | `composer-2` | 视觉模型 id |
| `CURSOR_AGENT_TIMEOUT_MS` | `600000` | 单次识别调用超时(毫秒) |

## 接入客户端

### Claude Code

```bash
claude mcp add image-recognition -e CURSOR_API_KEY="${CURSOR_API_KEY}" -- npx tsx D:/path/to/images-handler/src/index.ts
```

### Cursor

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "image-recognition": {
      "command": "npx",
      "args": ["tsx", "D:/path/to/images-handler/src/index.ts"],
      "env": {
        "CURSOR_API_KEY": "${CURSOR_API_KEY}"
      }
    }
  }
}
```

### 其他标准 MCP 客户端

stdio 传输,按标准协议配置启动命令即可(记得通过 `env` 传入 `CURSOR_API_KEY`)。

## 工具:`recognize_image`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `images` | string 或 string[] | 是 | 图片 data URI(`data:image/png;base64,...`)或 http(s) URL |
| `instruction` | string | 否 | 想针对图片问什么,缺省为"请详细描述这张图片的内容、画面元素和任何可见文字。" |
| `model` | string | 否 | 覆盖视觉模型(默认 `composer-2`) |

## 示例

```json
{
  "images": ["data:image/png;base64,iVBORw0KGgo..."]
}
```

带自定义指令:

```json
{
  "images": ["data:image/png;base64,iVBORw0KGgo..."],
  "instruction": "识别图中的文字并翻译成中文"
}
```

## 说明与限制

- 每次工具调用都会新建一个独立 Cursor agent(调用间不共享会话历史),用完即关闭。
- 服务**只做图片识别**:agent 恒为纯文本模式(`tools: []`),不执行 shell/文件工具,除传入的图片外不会读取或访问任何本地内容。
