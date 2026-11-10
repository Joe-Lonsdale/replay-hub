import { ReportView } from "@/components/report-view";
import { loadReport } from "@/lib/load-report";
import { requireUser } from "@/lib/session";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ playlist?: string; limit?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const { report, playlist, limit } = await loadReport(user, params.playlist, params.limit);
  return <ReportView report={report} playlist={playlist} limit={limit} basePath="/review" focus="review" />;
}
