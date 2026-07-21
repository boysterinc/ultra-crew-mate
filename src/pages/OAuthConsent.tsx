import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

// Beta `supabase.auth.oauth` namespace: keep a tiny typed wrapper so
// TypeScript sees the three methods this route needs.
interface OAuthDetails {
  client?: { name?: string; client_id?: string; redirect_uri?: string };
  scope?: string;
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
}
interface OAuthResult {
  data?: { redirect_url?: string; redirect_to?: string } | null;
  error?: { message: string } | null;
}
interface OAuthApi {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
}
const oauthApi = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

const OAuthConsent = () => {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      setUserEmail(sess.session.user.email ?? null);

      const { data, error } = await oauthApi.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    const { data, error } = approve
      ? await oauthApi.approveAuthorization(authorizationId)
      : await oauthApi.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  };

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm rounded-lg border border-border bg-card p-6 text-sm">
          <h1 className="text-lg font-semibold mb-2">Authorization error</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 text-muted-foreground">
        Loading…
      </main>
    );
  }

  const clientName = details.client?.name ?? "an app";
  const scopes = details.scopes ?? (details.scope ? details.scope.split(/\s+/).filter(Boolean) : []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-5 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
            Ultra Crew
          </p>
          <h1 className="text-xl font-bold mt-1">
            Connect {clientName} to AutoLap Scanner
          </h1>
        </div>

        <p className="text-sm text-muted-foreground">
          {clientName} will be able to call this app's enabled tools while you are signed in
          {userEmail ? ` as ${userEmail}` : ""}.
        </p>

        {scopes.length > 0 && (
          <div className="rounded-md border border-border p-3 text-xs space-y-1">
            <p className="font-medium">Requested permissions</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {scopes.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          This does not bypass this app's permissions or backend policies.
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => decide(false)}
          >
            Cancel
          </Button>
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
            Approve
          </Button>
        </div>
      </div>
    </main>
  );
};

export default OAuthConsent;
