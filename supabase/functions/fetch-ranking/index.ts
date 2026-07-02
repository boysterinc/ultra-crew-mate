// Fetch race ranking: scrape a race results URL via Firecrawl, then use
// Lovable AI to extract bib -> rank/time mapping for a given list of bibs.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  url: string;
  bibs: string[];
}

interface Ranking {
  bib: string;
  rank: number | null;
  time?: string | null;
  status?: string | null;
  lastCheckpoint?: string | null;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!firecrawlKey) {
      return json({ error: "FIRECRAWL_API_KEY missing" }, 500);
    }
    if (!lovableKey) {
      return json({ error: "LOVABLE_API_KEY missing" }, 500);
    }

    const { url, bibs } = (await req.json()) as Body;
    if (!url || !Array.isArray(bibs) || bibs.length === 0) {
      return json({ error: "url and bibs[] required" }, 400);
    }

    // 1) Scrape the results page - try with JS rendering for SPAs
    const fcRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "html"],
        onlyMainContent: false,
        waitFor: 5000,
        timeout: 45000,
      }),
    });
    const fcData = await fcRes.json();
    if (!fcRes.ok) {
      console.error("Firecrawl error", fcRes.status, fcData);
      return json({ error: `Firecrawl error ${fcRes.status}: ${JSON.stringify(fcData).slice(0, 300)}` }, 502);
    }
    const doc = fcData?.data ?? fcData;
    let markdown: string = doc?.markdown ?? "";
    const html: string = doc?.html ?? doc?.rawHtml ?? "";
    // Fallback: strip HTML to text if markdown is empty/short
    if ((!markdown || markdown.length < 20) && html) {
      markdown = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    if (!markdown || markdown.length < 20) {
      console.error("No content. Keys:", Object.keys(doc ?? {}));
      return json({ error: "No content scraped (page may require JS or block bots)" }, 502);
    }

    // Truncate to keep prompt reasonable
    const content = markdown.slice(0, 60_000);

    // 2) Ask Lovable AI to extract rankings for the given bibs
    const systemPrompt =
      "You are a data extraction assistant for race timing pages. " +
      "Given raw scraped markdown of a race results/leaderboard page and a list of BIB numbers, " +
      "return the current overall rank (position), finish/elapsed time, and the most recent checkpoint/split name (e.g. 'CP3', 'KM 42', 'Aid 5') for each requested BIB. " +
      "Look for tables/lists containing rank, position, place, or overall alongside bib numbers, plus columns like 'last checkpoint', 'last split', 'latest', 'CP', or 'station'. " +
      "Return STRICT JSON, no prose, matching: " +
      `{"rankings":[{"bib":"string","rank":number|null,"time":"string|null","status":"string|null","lastCheckpoint":"string|null"}]}. ` +
      "If a bib is not found, return rank=null. Status can be 'DNF','FIN','RUN' if visible, else null. lastCheckpoint should be short (<=12 chars) or null.";


    const userPrompt =
      `BIBs to find: ${bibs.join(", ")}\n\n--- RACE PAGE CONTENT ---\n${content}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": lovableKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errTxt = await aiRes.text();
      if (aiRes.status === 429) return json({ error: "Rate limit exceeded" }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: `AI error: ${errTxt}` }, 502);
    }
    const aiData = await aiRes.json();
    const rawText: string = aiData?.choices?.[0]?.message?.content ?? "{}";

    let parsed: { rankings?: Ranking[] } = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // try to extract JSON block
      const m = rawText.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
      }
    }
    const rankings: Ranking[] = Array.isArray(parsed.rankings) ? parsed.rankings : [];

    return json({
      ok: true,
      rankings,
      fetchedAt: Date.now(),
    });
  } catch (err) {
    console.error("fetch-ranking error", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
