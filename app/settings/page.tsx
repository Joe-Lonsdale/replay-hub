import { saveRlName } from "@/lib/actions";
import { TokenPanel } from "@/components/token-panel";
import { serviceStatus } from "@/lib/env";
import { requireUser } from "@/lib/session";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requireUser();
  const { saved } = await searchParams;
  const status = serviceStatus();

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
