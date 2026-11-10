"use client";

import { useEffect, useState } from "react";

interface Token {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export function TokenPanel({ appUrl }: { appUrl: string }) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/tokens");
    if (!response.ok) return;
    const body = (await response.json()) as { tokens: Token[] };
    setTokens(body.tokens);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function downloadListener() {
    setError(null);
    const response = await fetch("/api/listener", { method: "POST" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not download the listener");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ReplayLab.bat";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    await load();
  }

  async function createToken() {
    setError(null);
    const response = await fetch("/api/tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Windows helper" }),
    });
    const body = (await response.json()) as { secret?: string; error?: string };
    if (!response.ok || !body.secret) {
      setError(body.error ?? "Could not create a token");
      return;
    }
    setSecret(body.secret);
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/tokens/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <section className="border border-line bg-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl tracking-tight">Listener</h2>
        <button type="button" onClick={() => void createToken()} className="text-sm text-muted hover:text-ink">
          Create token
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">
        Download the listener and leave its window open. It does not need this project. Each download
        creates a token and puts it in the file, so do not share that file.
      </p>
      <button
        type="button"
        onClick={() => void downloadListener()}
        className="mt-4 bg-gold px-3 py-1.5 text-sm text-bg"
      >
        Download listener
      </button>
      {error ? <p className="mt-3 text-sm text-loss">{error}</p> : null}
      {secret ? (
        <>
          <pre className="mt-4 overflow-x-auto font-mono text-xs text-gold">{`npm run helper -- setup --token ${secret} --url ${appUrl}
npm run helper -- scan
npm run helper -- watch`}</pre>
          <p className="mt-2 text-sm text-muted">Those commands are for a checkout of this project. The download does the same thing.</p>
        </>
      ) : null}
      <ul className="mt-4 space-y-2 text-sm">
        {tokens.map((token) => (
          <li key={token.id} className="flex items-center justify-between gap-3 border-t border-line pt-2">
            <span>
              {token.name}{" "}
              <span className="font-mono text-muted">{token.prefix}…</span>
            </span>
            <button type="button" className="text-muted hover:text-loss" onClick={() => void remove(token.id)}>
              Revoke
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
