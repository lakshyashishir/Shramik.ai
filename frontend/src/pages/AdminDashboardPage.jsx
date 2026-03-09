import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Users, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { screeningApi } from "@/services/api";

const recommendationColor = {
  pass: "bg-green-100 text-green-700 border-green-200",
  hold: "bg-yellow-100 text-yellow-700 border-yellow-200",
  reject: "bg-red-100 text-red-700 border-red-200",
  pending: "bg-slate-100 text-slate-700 border-slate-200",
};

function MetricCard({ title, value, subtitle, icon: Icon, testId }) {
  return (
    <Card className="border-border/60" data-testid={testId}>
      <CardHeader className="pb-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground" data-testid={`${testId}-title`}>
          {title}
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-heading text-4xl text-primary" data-testid={`${testId}-value`}>
              {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground" data-testid={`${testId}-subtitle`}>
              {subtitle}
            </p>
          </div>
          <div className="rounded-full bg-primary/10 p-3 text-primary" data-testid={`${testId}-icon-wrap`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [liveSessions, setLiveSessions] = useState([]);
  const [reports, setReports] = useState([]);
  const [workers, setWorkers] = useState([]);

  const fetchDashboard = async () => {
    try {
      const [liveData, reportData, workerData] = await Promise.all([
        screeningApi.listLiveSessions(),
        screeningApi.listReports(),
        screeningApi.listWorkers(),
      ]);
      setLiveSessions(liveData);
      setReports(reportData);
      setWorkers(workerData);
    } catch (error) {
      // keep prior values if one refresh fails
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 8000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const passCount = reports.filter((session) => session.recommendation === "pass").length;
    const rejectCount = reports.filter((session) => session.recommendation === "reject").length;
    const passRate = reports.length ? Math.round((passCount / reports.length) * 100) : 0;

    return {
      workers: workers.length,
      active: liveSessions.length,
      passRate,
      rejected: rejectCount,
    };
  }, [liveSessions, reports, workers]);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8 md:px-10" data-testid="admin-dashboard-page">
      <section className="space-y-2" data-testid="admin-header-section">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent" data-testid="admin-header-kicker">
          command center
        </p>
        <h1 className="font-heading text-4xl text-primary md:text-5xl" data-testid="admin-main-heading">
          Screening Operations Dashboard
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground md:text-base" data-testid="admin-heading-description">
          Monitor live tailor screenings, evaluate decisions, and compare AI recommendation trends across sessions.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4" data-testid="admin-metrics-grid">
        <MetricCard
          title="Total Workers"
          value={stats.workers}
          subtitle="registered profiles"
          icon={Users}
          testId="metric-total-workers"
        />
        <MetricCard
          title="Active Sessions"
          value={stats.active}
          subtitle="live right now"
          icon={Activity}
          testId="metric-active-sessions"
        />
        <MetricCard
          title="Pass Rate"
          value={`${stats.passRate}%`}
          subtitle="completed reports"
          icon={CheckCircle2}
          testId="metric-pass-rate"
        />
        <MetricCard
          title="Rejected"
          value={stats.rejected}
          subtitle="final recommendations"
          icon={XCircle}
          testId="metric-rejected-count"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12" data-testid="admin-content-grid">
        <Card className="lg:col-span-7" data-testid="live-sessions-panel">
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-primary" data-testid="live-sessions-title">
              Live Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {liveSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="live-sessions-empty-state">
                No active screenings at this moment.
              </p>
            ) : (
              liveSessions.map((session) => {
                const latestTurn = session.transcript?.[session.transcript.length - 1]?.text || "No transcript yet.";
                return (
                  <article
                    key={session.id}
                    className="rounded-xl border border-border/60 bg-muted/20 p-4"
                    data-testid={`live-session-card-${session.id}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-primary" data-testid={`live-session-worker-${session.id}`}>
                        {session.worker_name}
                      </p>
                      <Badge className="bg-accent/10 text-accent" data-testid={`live-session-score-${session.id}`}>
                        {Math.round(session.live_score)}% live score
                      </Badge>
                    </div>
                    <p
                      className="mt-2 line-clamp-2 text-xs text-muted-foreground"
                      data-testid={`live-session-assignment-${session.id}`}
                    >
                      Assignment: {session.assignment}
                    </p>
                    <p
                      className="mt-2 rounded-lg border border-border/60 bg-background p-2 text-sm"
                      data-testid={`live-session-latest-turn-${session.id}`}
                    >
                      {latestTurn}
                    </p>
                  </article>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5" data-testid="recent-reports-panel">
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-primary" data-testid="recent-reports-title">
              Recent Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1" data-testid="recent-reports-list">
              {reports.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="reports-empty-state">
                  No completed reports yet.
                </p>
              ) : (
                reports.map((report) => (
                  <article
                    key={report.id}
                    className="rounded-xl border border-border/60 bg-background p-3"
                    data-testid={`report-item-${report.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-primary" data-testid={`report-worker-name-${report.id}`}>
                        {report.worker_name}
                      </p>
                      <Badge
                        className={`border ${recommendationColor[report.recommendation] || recommendationColor.pending}`}
                        data-testid={`report-recommendation-${report.id}`}
                      >
                        {report.recommendation.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="mt-1 font-mono text-xs text-accent" data-testid={`report-score-${report.id}`}>
                      Final score: {Math.round(report.live_score)}%
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground" data-testid={`report-summary-${report.id}`}>
                      {report.summary}
                    </p>
                  </article>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
