import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "echo",
  title: "Echo",
  description: "Echo the input text back. Useful to verify MCP connectivity and auth.",
  inputSchema: { text: z.string().min(1).describe("Text to echo back.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ text }, ctx) => ({
    content: [
      {
        type: "text",
        text: ctx.isAuthenticated()
          ? `Hello ${ctx.getUserEmail() ?? ctx.getUserId() ?? "user"}: ${text}`
          : text,
      },
    ],
  }),
});
