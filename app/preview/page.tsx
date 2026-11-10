import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/report-view";
import { previewGames } from "@/lib/coaching/fixtures";
import { buildReport } from "@/lib/coaching/report";

const PLAYLISTS = new Set(["duel", "doubles", "standard", "extra"]);

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ playlist?: string; limit?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const requested = params.playlist === "all" ? null : params.playlist || "doubles";
  const playlist = requested && PLAYLISTS.has(requested) ? requested : requested === null ? "all" : "doubles";
  const limit = [20, 50, 100].includes(Number(params.limit)) ? Number(params.limit) : 50;
  const games = previewGames()
    .filter((game) => playlist === "all" || game.replay.playlist === playlist)
    .slice(0, limit);
  return (
    <div className="space-y-8">
      <p className="text-sm text-muted">
        <Link href="/preview/scenarios" className="text-gold">
          Open the scenario builder
        </Link>{" "}
        on this sample, or sign in to run chains against your own games.
      </p>
      <ReportView report={buildReport(games)} playlist={playlist} limit={limit} basePath="/preview" focus="review" />
    </div>
  );
}
