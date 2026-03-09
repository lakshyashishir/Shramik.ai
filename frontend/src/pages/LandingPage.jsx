import { Link } from "react-router-dom";
import { ArrowRight, Camera, Mic, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const heroImage =
  "https://images.unsplash.com/photo-1765875485716-a3df3990af2d?crop=entropy&cs=srgb&fm=jpg&q=85";
const workshopImage =
  "https://images.unsplash.com/photo-1770910195240-ddec777b77f6?crop=entropy&cs=srgb&fm=jpg&q=85";

const features = [
  {
    title: "Live AI Voice Screening",
    description:
      "Each worker gets a practical voice interview where AI asks assignment-focused tailoring questions in real time.",
    icon: Mic,
    testId: "feature-live-voice-screening",
  },
  {
    title: "Video Presence + AI Eye",
    description:
      "Workers can see that AI is actively observing. This creates accountability and improves screening quality.",
    icon: Camera,
    testId: "feature-video-presence-ai-eye",
  },
  {
    title: "Snapshot Skill Assessment",
    description:
      "AI captures and scores visual checkpoints while a tailor shows seam quality, finishing, and precision.",
    icon: ShieldCheck,
    testId: "feature-snapshot-assessment",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-6 py-10 md:px-10 md:py-14">
      <section
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
        data-testid="landing-hero-section"
      >
        <article className="relative overflow-hidden rounded-[2rem] md:col-span-8" data-testid="landing-hero-card">
          <img
            src={heroImage}
            alt="Tailoring workstation"
            className="h-[520px] w-full object-cover"
            data-testid="landing-hero-image"
          />
          <div className="hero-overlay absolute inset-0 p-6 md:p-10">
            <div className="flex h-full flex-col justify-end gap-5">
              <p className="text-sm uppercase tracking-[0.2em] text-white/85" data-testid="hero-kicker-text">
                Real-time workforce intelligence
              </p>
              <h1
                className="font-heading text-4xl leading-[0.92] text-white sm:text-5xl lg:text-6xl"
                data-testid="hero-main-heading"
              >
                Screen tailoring workers with a live AI voice + video evaluator.
              </h1>
              <p
                className="max-w-2xl text-sm text-white/90 md:text-base"
                data-testid="hero-description-text"
              >
                shram helps workshop teams run practical, assignment-based interviews with objective scoring and
                snapshot feedback.
              </p>
              <div className="flex flex-wrap items-center gap-4" data-testid="hero-cta-group">
                <Button
                  asChild
                  className="h-12 rounded-full px-8 text-base transition-transform duration-300 hover:scale-105"
                  data-testid="hero-start-screening-button"
                >
                  <Link to="/screening">
                    Start Live Screening
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  className="h-12 rounded-full bg-secondary/15 px-7 text-base text-white hover:bg-secondary/30"
                  data-testid="hero-open-admin-button"
                >
                  <Link to="/admin">Open Admin Command Center</Link>
                </Button>
              </div>
            </div>
          </div>
        </article>

        <article
          className="soft-glass flex flex-col justify-between rounded-[2rem] p-6 md:col-span-4"
          data-testid="landing-right-highlight-card"
        >
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-primary" data-testid="right-card-tagline">
              screening standard
            </p>
            <h2 className="mt-3 font-heading text-3xl text-primary" data-testid="right-card-heading">
              Assignment-first evaluation.
            </h2>
            <p className="mt-4 text-sm text-foreground/80" data-testid="right-card-description">
              AI asks practical questions, tracks confidence changes, and records evaluation moments with snapshot-based
              quality notes.
            </p>
          </div>
          <img
            src={workshopImage}
            alt="Tailor discussing work"
            className="mt-8 h-56 w-full rounded-2xl object-cover"
            data-testid="right-card-workshop-image"
          />
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3" data-testid="landing-features-grid">
        {features.map((feature) => (
          <Card
            key={feature.title}
            className="rounded-3xl border-border/50 shadow-xl shadow-primary/5 transition-transform duration-300 hover:-translate-y-1"
            data-testid={feature.testId}
          >
            <CardHeader>
              <div className="mb-4 inline-flex w-fit rounded-full bg-accent/10 p-3 text-accent" data-testid={`${feature.testId}-icon-wrap`}>
                <feature.icon className="h-5 w-5" />
              </div>
              <CardTitle className="font-heading text-2xl text-primary" data-testid={`${feature.testId}-title`}>
                {feature.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground md:text-base" data-testid={`${feature.testId}-description`}>
                {feature.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
