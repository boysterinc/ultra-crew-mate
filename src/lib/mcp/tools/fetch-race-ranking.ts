import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "fetch_race_ranking",
  title: "Fetch race ranking",
  description:
    "Given a public race results/leaderboard URL and one or more BIB numbers, fetch the current overall rank, elapsed time, status, and last checkpoint for each BIB. Uses AutoLap's server-side scraper.",
  inputSchema: {
    url: z.string().url().describe("Public race results/leaderboard URL."),
    bibs: z
      .array(z.string().min(1))
      .min(1)
      .describe("BIB numbers to look up (strings)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async ({ url, bibs }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return {
        content: [{ type: "text", text: "Not authenticated" }],
        isError: true,
      };
    }
    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !anonKey) {
      return {
        content: [{ type: "text", text: "Server not configured (missing SUPABASE_URL / anon key)." }],
        isError: true,
      };
    }
    const res = await fetch(`${supabaseUrl}/functions/v1/fetch-ranking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ url, bibs }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        content: [
          {
            type: "text",
            text: `Ranking fetch failed (${res.status}): ${JSON.stringify(data).slice(0, 300)}`,
          },
        ],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data.rankings ?? [], null, 2) }],
      structuredContent: { rankings: data.rankings ?? [], fetchedAt: data.fetchedAt ?? null },
    };
  },
});
