import { Agent } from "@cursor/sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { normalizeImages, toSdkImageAsync } from "./images.js";

// --- configuration -----------------------------------------------------------

const CURSOR_API_KEY = process.env.CURSOR_API_KEY;
const DEFAULT_MODEL = process.env.CURSOR_MODEL ?? "composer-2";
const rawTimeout = Number(process.env.CURSOR_AGENT_TIMEOUT_MS ?? 600_000);
const TIMEOUT_MS = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 600_000;
const DEFAULT_INSTRUCTION = "请详细描述这张图片的内容、画面元素和任何可见文字。";

interface RunArgs {
  instruction: string;
  images: string[];
  model?: string;
}

async function runCursorAgent(args: RunArgs): Promise<string> {
  const images = await Promise.all(args.images.map(toSdkImageAsync));

  // A fresh agent per call so tool invocations never share conversation history.
  // tools: [] → text-only; this server only recognizes images and never grants
  // the model shell/file access.
  const agent = await Agent.create({
    name: "image-recognition",
    apiKey: CURSOR_API_KEY,
    model: { id: args.model ?? DEFAULT_MODEL },
    tools: [],
    local: { cwd: process.cwd() },
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const run = await agent.send({ text: args.instruction, images });
    const waitPromise = run.wait();
    // The loser of the race still rejects later (e.g. cancel); keep its
    // rejection observed so it doesn't surface as an unhandled rejection.
    waitPromise.catch(() => {});
    const result = await Promise.race([
      waitPromise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          void run.cancel().catch((err) => {
            console.error("cursor agent cancel failed:", err);
          });
          reject(new Error(`cursor agent timed out after ${TIMEOUT_MS}ms`));
        }, TIMEOUT_MS);
      }),
    ]);
    if (result.error) throw new Error(result.error.message);
    if (result.result === undefined) throw new Error("cursor agent returned no result");
    return result.result;
  } finally {
    clearTimeout(timer);
    agent.close();
  }
}

// --- MCP server --------------------------------------------------------------

const server = new McpServer({ name: "image-recognition", version: "0.1.0" });

server.registerTool(
  "recognize_image",
  {
    description:
      "Recognize and analyze the given image(s) with a vision model and return a text description. " +
      "Use this to give text-only LLMs like DeepSeek image understanding.",
    inputSchema: {
      images: z
        .union([z.string(), z.array(z.string())])
        .describe(
          "Image data URI (data:image/png;base64,...), http(s) URL, or local image file path to recognize.",
        ),
      instruction: z
        .string()
        .optional()
        .describe(`What to ask about the image. Default: ${DEFAULT_INSTRUCTION}`),
      model: z.string().optional().describe(`Vision model id (default: ${DEFAULT_MODEL}).`),
    },
  },
  async (args) => {
    try {
      const text = await runCursorAgent({
        instruction: args.instruction ?? DEFAULT_INSTRUCTION,
        images: normalizeImages(args.images) ?? [],
        model: args.model,
      });
      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `recognize_image failed: ${message}` }],
        isError: true,
      };
    }
  },
);

await server.connect(new StdioServerTransport());
