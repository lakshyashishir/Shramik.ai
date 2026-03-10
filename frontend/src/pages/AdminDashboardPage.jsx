import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Users, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { screeningApi } from "@/services/api";
import { useLanguage } from "@/i18n/language";

const recommendationColor = {
  pass: "bg-green-100 text-green-700 border-green-200",
  hold: "bg-yellow-100 text-yellow-700 border-yellow-200",
  reject: "bg-red-100 text-red-700 border-red-200",
  pending: "bg-slate-100 text-slate-700 border-slate-200",
};

const copyMap = {
  en: {
    kicker: "command center",
    title: "Screening Operations Dashboard",
    description: "Monitor live worker screenings, evaluate decisions, and compare AI recommendation trends across sessions.",
    metrics: {
      workers: ["Total Workers", "registered profiles"],
      active: ["Active Sessions", "live right now"],
      passRate: ["Pass Rate", "completed reports"],
      rejected: ["Rejected", "final recommendations"],
    },
    live: {
      title: "Live Sessions",
      empty: "No active screenings at this moment.",
      noTranscript: "No transcript yet.",
      scoreSuffix: "live score",
      assignment: "Assignment",
    },
    reports: {
      title: "Recent Reports",
      empty: "No completed reports yet.",
      finalScore: "Final score",
      integrity: "Integrity",
      clear: "clear",
      multiFace: "multi-face",
      absent: "absent",
      gaze: "gaze",
    },
  },
  hi: {
    kicker: "\u0915\u092e\u093e\u0902\u0921 \u0938\u0947\u0902\u091f\u0930",
    title: "\u0938\u094d\u0915\u094d\u0930\u0940\u0928\u093f\u0902\u0917 \u0911\u092a\u0930\u0947\u0936\u0928\u094d\u0938 \u0921\u0948\u0936\u092c\u094b\u0930\u094d\u0921",
    description: "\u0932\u093e\u0907\u0935 worker screening \u092e\u0949\u0928\u093f\u091f\u0930 \u0915\u0930\u0947\u0902, decision \u0915\u093e \u092e\u0942\u0932\u094d\u092f\u093e\u0902\u0915\u0928 \u0915\u0930\u0947\u0902, \u0914\u0930 AI recommendation trends compare \u0915\u0930\u0947\u0902\u0964",
    metrics: {
      workers: ["\u0915\u0941\u0932 worker", "\u0930\u091c\u093f\u0938\u094d\u091f\u0930\u094d\u0921 profile"],
      active: ["\u0938\u0915\u094d\u0930\u093f\u092f session", "\u0905\u092d\u0940 \u0932\u093e\u0907\u0935"],
      passRate: ["\u092a\u093e\u0938 \u0930\u0947\u091f", "\u092a\u0942\u0930\u094d\u0923 report"],
      rejected: ["\u0930\u093f\u091c\u0947\u0915\u094d\u091f\u0947\u0921", "\u0905\u0902\u0924\u093f\u092e recommendation"],
    },
    live: {
      title: "\u0932\u093e\u0907\u0935 session",
      empty: "\u0907\u0938 \u0938\u092e\u092f \u0915\u094b\u0908 active screening \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
      noTranscript: "\u0905\u092d\u0940 transcript \u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
      scoreSuffix: "\u0932\u093e\u0907\u0935 score",
      assignment: "\u0905\u0938\u093e\u0907\u0928\u092e\u0947\u0902\u091f",
    },
    reports: {
      title: "\u0939\u093e\u0932 \u0915\u0940 report",
      empty: "\u0905\u092d\u0940 \u0915\u094b\u0908 completed report \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
      finalScore: "\u0905\u0902\u0924\u093f\u092e score",
      integrity: "\u0907\u0902\u091f\u0947\u0917\u094d\u0930\u093f\u091f\u0940",
      clear: "clear",
      multiFace: "multi-face",
      absent: "absent",
      gaze: "gaze",
    },
  },
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
  const { locale } = useLanguage();
  const copy = copyMap[locale] ?? copyMap.en;
  const [liveSessions, setLiveSessions] = useState([]);
  const [reports, setReports] = useState([]);
  const [workers, setWorkers] = useState([]);

  useEffect(() => {
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
      } catch {
        // keep prior values if one refresh fails
      }
    };

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
          {copy.kicker}
        </p>
        <h1 className="font-heading text-4xl text-primary md:text-5xl" data-testid="admin-main-heading">
          {copy.title}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground md:text-base" data-testid="admin-heading-description">
          {copy.description}
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4" data-testid="admin-metrics-grid">
        <MetricCard title={copy.metrics.workers[0]} value={stats.workers} subtitle={copy.metrics.workers[1]} icon={Users} testId="metric-total-workers" />
        <MetricCard title={copy.metrics.active[0]} value={stats.active} subtitle={copy.metrics.active[1]} icon={Activity} testId="metric-active-sessions" />
        <MetricCard title={copy.metrics.passRate[0]} value={`${stats.passRate}%`} subtitle={copy.metrics.passRate[1]} icon={CheckCircle2} testId="metric-pass-rate" />
        <MetricCard title={copy.metrics.rejected[0]} value={stats.rejected} subtitle={copy.metrics.rejected[1]} icon={XCircle} testId="metric-rejected-count" />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12" data-testid="admin-content-grid">
        <Card className="lg:col-span-7" data-testid="live-sessions-panel">
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-primary" data-testid="live-sessions-title">
              {copy.live.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {liveSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="live-sessions-empty-state">
                {copy.live.empty}
              </p>
            ) : (
              liveSessions.map((session) => {
                const latestTurn = session.transcript?.[session.transcript.length - 1]?.text || copy.live.noTranscript;
                return (
                  <article key={session.id} className="rounded-xl border border-border/60 bg-muted/20 p-4" data-testid={`live-session-card-${session.id}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-primary" data-testid={`live-session-worker-${session.id}`}>
                        {session.worker_name}
                      </p>
                      <Badge className="bg-accent/10 text-accent" data-testid={`live-session-score-${session.id}`}>
                        {Math.round(session.live_score)}% {copy.live.scoreSuffix}
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground" data-testid={`live-session-assignment-${session.id}`}>
                      {copy.live.assignment}: {session.assignment}
                    </p>
                    <p className="mt-2 rounded-lg border border-border/60 bg-background p-2 text-sm" data-testid={`live-session-latest-turn-${session.id}`}>
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
              {copy.reports.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1" data-testid="recent-reports-list">
              {reports.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="reports-empty-state">
                  {copy.reports.empty}
                </p>
              ) : (
                reports.map((report) => (
                  <article key={report.id} className="rounded-xl border border-border/60 bg-background p-3" data-testid={`report-item-${report.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-primary" data-testid={`report-worker-name-${report.id}`}>
                        {report.worker_name}
                      </p>
                      <Badge className={`border ${recommendationColor[report.recommendation] || recommendationColor.pending}`} data-testid={`report-recommendation-${report.id}`}>
                        {report.recommendation.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="mt-1 font-mono text-xs text-accent" data-testid={`report-score-${report.id}`}>
                      {copy.reports.finalScore}: {Math.round(report.live_score)}%
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground" data-testid={`report-integrity-flag-${report.id}`}>
                      {copy.reports.integrity}: {report.integrity_log?.overall_flag || copy.reports.clear}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground" data-testid={`report-integrity-events-${report.id}`}>
                      {copy.reports.multiFace} {report.integrity_log?.multiface_events || 0} | {copy.reports.absent} {report.integrity_log?.face_absent_events || 0} | {copy.reports.gaze} {report.integrity_log?.gaze_deviation_events || 0}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground" data-testid={`report-summary-${report.id}`}>
                      {report.summary}
                    </p>
                    {report.rubric_scores && Object.keys(report.rubric_scores).filter(k => k !== "integrity_compliance").length > 0 && (
                      <div className="mt-3 space-y-1.5" data-testid={`report-rubric-breakdown-${report.id}`}>
                        {[
                          { key: "stitch_quality",            label: "Stitch",    w: "32%" },
                          { key: "machine_familiarity",       label: "Machine",   w: "26%" },
                          { key: "technical_knowledge",       label: "Technical", w: "24%" },
                          { key: "fabric_material_knowledge", label: "Fabric",    w: "12%" },
                          { key: "communication_confidence",  label: "Comm.",     w: "6%"  },
                        ].filter(({ key }) => report.rubric_scores[key] != null).map(({ key, label, w }) => {
                          const score = Math.round(report.rubric_scores[key]);
                          const barColor = score >= 70 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";
                          return (
                            <div key={key}>
                              <div className="flex justify-between">
                                <span className="font-mono text-[10px] text-muted-foreground">{label} <span className="opacity-50">({w})</span></span>
                                <span className="font-mono text-[10px] font-bold text-primary">{score}</span>
                              </div>
                              <div className="h-1 rounded-full bg-muted">
                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
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
