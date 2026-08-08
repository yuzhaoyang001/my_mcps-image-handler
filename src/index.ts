import { Agent } from "@cursor/sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { normalizeImages, toSdkImage } from "./images.js";

// --- configuration -----------------------------------------------------------

const CURSOR_API_KEY = process.env.CURSOR_API_KEY;
const DEFAULT_MODEL = process.env.CURSOR_MODEL ?? "composer-2";
const rawTimeout = Number(process.env.CURSOR_AGENT_TIMEOUT_MS ?? 600_000);
const TIMEOUT_MS = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 600_000;

interface RunArgs {
  instruction: string;
  images?: string[];
  model?: string;
  tools?: boolean;
  cwd?: string;
}

async function runCursorAgent(args: RunArgs): Promise<string> {
  const images = (args.images ?? []).map(toSdkImage);

  // A fresh agent per call so tool invocations never share conversation history.
  const agent = await Agent.create({
    name: "mcp-cursor-agent",
    apiKey: CURSOR_API_KEY,
    model: { id: args.model ?? DEFAULT_MODEL },
    // Default tools: [] → the agent only replies with text (no shell/file tools).
    // Pass tools: true to enable the full agent toolset.
    tools: args.tools === true ? undefined : [],
    local: { cwd: args.cwd ?? process.cwd() },
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const run = await agent.send(
      images.length > 0 ? { text: args.instruction, images } : args.instruction,
    );
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

const server = new McpServer({ name: "cursor-agent", version: "0.1.0" });

server.registerTool(
  "cursor_agent",
  {
    description:
      "Run a Cursor agent. Accepts an instruction and optional images (data URIs or URLs) — " +
      "gives text-only models like DeepSeek image understanding, and doubles as a general agent.",
    inputSchema: {
      instruction: z
        .string()
        .describe("What to ask the agent. For images, e.g. 'Describe this image in detail'."),
      images: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe("One or more image data URIs (data:image/png;base64,...) or http(s) URLs."),
      model: z.string().optional().describe(`Model id (default: ${DEFAULT_MODEL}).`),
      tools: z
        .boolean()
        .optional()
        .describe(
          "When true the agent can use shell/file tools (general agent mode). Default false — the agent only answers in text (safe mode for pure image understanding).",
        ),
      cwd: z
        .string()
        .optional()
        .describe(
          "Working directory for the agent (relevant only when tools are enabled). Default: the server's cwd.",
        ),
    },
  },
  async (args) => {
    try {
      const text = await runCursorAgent({
        ...args,
        images: normalizeImages(args.images),
      });
      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `cursor_agent failed: ${message}` }],
        isError: true,
      };
    }
  },
);

await server.connect(new StdioServerTransport());
