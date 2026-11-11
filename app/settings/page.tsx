import {
  disconnectRlapi,
  finishRlapiConnect,
  saveRlName,
  startRlapiConnect,
  syncRlapiReplays,
} from "@/lib/actions";
import { TokenPanel } from "@/components/token-panel";
import { serviceStatus } from "@/lib/env";
import { getRlApiConnection, getRlApiDeviceAuth } from "@/lib/repo";
import { requireUser } from "@/lib/session";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    rlapi?: string;
    rlapi_error?: string;
    seen?: string;
    imported?: string;
    duplicates?: string;
    failed?: string;
    skipped?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const { saved } = params;
  const status = serviceStatus();
  const rlapiConnection = await getRlApiConnection(user.id);
  const pendingRlapi = await getRlApiDeviceAuth(user.id);
  const pendingExpired = pendingRlapi ? new Date(pendingRlapi.expiresAt).getTime() < Date.now() : false;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <p className="font-mono text-xs tracking-[0.22em] text-gold uppercase">Account</p>
        <h1 className="mt-3 text-4xl tracking-tight">{user.personaName}</h1>
        <p className="mt-2 font-mono text-sm text-muted">{user.id}</p>
      </div>

      <form action={saveRlName} className="border border-line bg-panel p-4">
        <label htmlFor="rlName" className="text-lg tracking-tight">
          In-game name
        </label>
        <p className="mt-1 text-sm text-muted">
          Used when the replay player id is not your Steam id. Epic-linked accounts need this.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            id="rlName"
            name="rlName"
            defaultValue={user.rlName ?? ""}
            className="min-w-64 border border-line px-3 py-2"
            autoComplete="off"
          />
          <button type="submit" className="bg-ink px-3 py-2 text-bg">
            Save
          </button>
        </div>
        {saved ? <p className="mt-3 text-sm text-win">Saved. Older replays will match on the next view.</p> : null}
      </form>

      <TokenPanel appUrl={status.appUrl} />

      <section className="border border-line bg-panel p-4">
        <h2 className="text-lg tracking-tight">RLAPI replay sync</h2>
        <p className="mt-1 text-sm text-muted">
          Connect Epic once, then pull recent match history from RLAPI and save those replay files to your ledger.
        </p>
        {rlapiConnection ? (
          <div className="mt-4 border border-line p-3 text-sm">
            <p>
              Connected as <span className="font-mono">{rlapiConnection.displayName}</span>.
            </p>
            <p className="mt-1 text-xs text-muted">Epic account {rlapiConnection.epicAccountId}</p>
            <form action={disconnectRlapi} className="mt-3">
              <button type="submit" className="border border-line px-3 py-2 text-xs text-muted">
                Disconnect
              </button>
            </form>
          </div>
        ) : (
          <form action={startRlapiConnect} className="mt-4">
            <button type="submit" className="bg-ink px-3 py-2 text-bg">
              Connect Epic account
            </button>
          </form>
        )}
        {pendingRlapi && !rlapiConnection ? (
          <div className="mt-4 border border-line p-3 text-sm">
            <p>Open Epic and enter this code:</p>
            <p className="mt-2 font-mono text-2xl text-gold">{pendingRlapi.userCode}</p>
            <p className="mt-2 break-all text-muted">{pendingRlapi.verificationUri}</p>
            <form action={finishRlapiConnect} className="mt-3">
              <button type="submit" disabled={pendingExpired} className="bg-gold px-3 py-2 text-bg disabled:opacity-50">
                I authorized Epic
              </button>
            </form>
            {pendingExpired ? <p className="mt-2 text-xs text-loss">This code expired. Start connection again.</p> : null}
          </div>
        ) : null}
        <form action={syncRlapiReplays} className="mt-4 flex flex-wrap items-end gap-3">
          <label htmlFor="rlapiLimit" className="grid gap-1 text-sm">
            Unsynced replays
            <input
              id="rlapiLimit"
              name="limit"
              type="number"
              min={1}
              max={100}
              defaultValue={25}
              className="w-28 border border-line px-3 py-2"
            />
          </label>
          <button type="submit" disabled={!rlapiConnection} className="bg-ink px-3 py-2 text-bg disabled:opacity-50">
            Sync RLAPI replays
          </button>
        </form>
        {!rlapiConnection ? <p className="mt-3 text-xs text-muted">Connect Epic before syncing replays.</p> : null}
        {params.rlapi === "connected" ? <p className="mt-3 text-sm text-win">Epic account connected.</p> : null}
        {params.rlapi === "disconnected" ? <p className="mt-3 text-sm text-win">Epic account disconnected.</p> : null}
        {params.rlapi === "synced" ? (
          <p className="mt-3 text-sm text-win">
            RLAPI sync checked {params.seen ?? 0}, imported {params.imported ?? 0}, refreshed {params.duplicates ?? 0}
            {params.skipped && params.skipped !== "0" ? `, skipped ${params.skipped}` : ""}
            {params.failed && params.failed !== "0" ? `, failed ${params.failed}` : ""}.
          </p>
        ) : null}
        {params.rlapi_error ? <p className="mt-3 text-sm text-loss">{params.rlapi_error}</p> : null}
      </section>

      <section className="border border-line p-4 text-sm">
        <h2 className="text-lg tracking-tight">Where things live</h2>
        <dl className="mt-3 space-y-2">
          <Row label="Database" value={status.database} />
          <Row label="Replay files" value={status.storage} />
          <Row label="Steam profile" value={status.steam ? "API key set" : "Login works; names need STEAM_API_KEY"} />
          <Row label="App URL" value={status.appUrl} />
        </dl>
        {status.vercel && !status.r2 ? (
          <p className="mt-4 text-loss">
            This deployment has no R2 bucket. Stats can still save. Replay files will not, because
            Vercel does not keep a disk.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
