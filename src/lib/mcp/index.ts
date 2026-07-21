import { auth, defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import fetchRaceRankingTool from "./tools/fetch-race-ranking";

// Build the OAuth issuer from the project ref so it stays the direct
// supabase.co host (mcp-js rejects proxy issuers). VITE_SUPABASE_PROJECT_ID is
// inlined by Vite at build time — safe at module load.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "autolap-scanner-mcp",
  title: "AutoLap Scanner",
  version: "0.1.0",
  instructions:
    "Tools for the AutoLap Scanner app. Use `echo` to verify connectivity, or `fetch_race_ranking` to look up a runner's current rank and last checkpoint from a public race results URL.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [echoTool, fetchRaceRankingTool],
});
