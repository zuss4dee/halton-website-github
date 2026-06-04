import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { safeRedirectAfterLogin } from "@/lib/auth/redirects";
import { fetchAuthProfile } from "@/lib/auth/profile";
import { guardLoginRoute } from "@/lib/auth/routeGuard";
import { supabase } from "@/lib/supabase";

type LoginSearch = {
  redirect?: string;
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: async () => {
    await guardLoginRoute();
  },
  head: () => ({
    meta: [
      { title: "Login — Halton/Works" },
      {
        name: "description",
        content: "Secure access to Halton Works client workspace and command center.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect: redirectAfter } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    const user = data.user;
    if (!user) {
      setError("SIGN_IN_FAILED // NO_USER_RETURNED");
      setIsSubmitting(false);
      return;
    }

    const profile = await fetchAuthProfile(supabase, user.id);
    if (!profile) {
      await supabase.auth.signOut();
      setError(
        "ACCESS_DENIED // NO_PROFILE. Contact Halton to provision your account.",
      );
      setIsSubmitting(false);
      return;
    }

    const destination = safeRedirectAfterLogin(redirectAfter, profile);

    if (destination.startsWith("/workspace/")) {
      const workspaceClientId = destination.split("/")[2];
      if (workspaceClientId) {
        await navigate({
          to: "/workspace/$clientId",
          params: { clientId: workspaceClientId },
        });
        setIsSubmitting(false);
        return;
      }
    }

    await navigate({ to: destination as "/admin" | "/login" });
    setIsSubmitting(false);
  }

  return (
    <main className="min-h-screen bg-paper text-ink selection:bg-ink selection:text-paper">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-14">
        <header className="border-b border-hairline pb-8 text-center">
          <div className="eyebrow mb-3">Halton/Works // Auth Gate</div>
          <h1 className="font-display text-[clamp(2rem,6vw,2.75rem)] leading-[0.9] tracking-[-0.04em]">
            TERMINAL_LOGIN
          </h1>
          <p className="mt-4 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-soft">
            EMAIL + PASSWORD REQUIRED
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6">
          <label className="block">
            <span className="mb-2 block font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
              Email
            </span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full border border-hairline bg-paper px-3 py-3 font-mono text-[12px] tracking-[0.06em] text-ink outline-none focus:border-ink"
              placeholder="you@company.com"
            />
          </label>

          <label className="block">
            <span className="mb-2 block font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
              Password
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full border border-hairline bg-paper px-3 py-3 font-mono text-[12px] tracking-[0.06em] text-ink outline-none focus:border-ink"
              placeholder="••••••••"
            />
          </label>

          {error ? (
            <p className="border border-red-700/40 bg-red-50 px-3 py-3 font-mono text-[10px] tracking-[0.12em] uppercase text-red-800">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full border border-ink bg-ink px-4 py-3 font-mono text-[11px] tracking-[0.2em] uppercase text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? "AUTHENTICATING…" : "[ Sign In ]"}
          </button>
        </form>

        <p className="mt-8 text-center font-mono text-[10px] leading-relaxed tracking-[0.1em] uppercase text-ink-soft">
          Client accounts match onboarded primary contact email.
          <br />
          Admin access is provisioned manually.
        </p>
      </div>
    </main>
  );
}
