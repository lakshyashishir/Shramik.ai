import { Link } from "react-router-dom";
import { ArrowRight, Camera, Mic, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/i18n/language";

const heroImage =
  "https://images.unsplash.com/photo-1765875485716-a3df3990af2d?crop=entropy&cs=srgb&fm=jpg&q=85";
const workshopImage =
  "https://images.unsplash.com/photo-1770910195240-ddec777b77f6?crop=entropy&cs=srgb&fm=jpg&q=85";

const landingCopy = {
  en: {
    kicker: "Real-time workforce intelligence",
    title: "Screen workers for any skill with a live AI voice + video evaluator.",
    description:
      "Shramik helps teams run practical, assignment-based interviews with objective scoring and snapshot feedback.",
    primaryCta: "Start Live Screening",
    secondaryCta: "Open Admin Command Center",
    sideKicker: "screening standard",
    sideTitle: "Assignment-first evaluation.",
    sideDescription:
      "AI asks practical questions, tracks confidence changes, and records evaluation moments with snapshot-based quality notes.",
    heroAlt: "Skilled worker workstation",
    sideAlt: "Worker discussing a practical assignment",
    features: [
      {
        title: "Live AI Voice Screening",
        description:
          "Each worker gets a practical voice interview where AI asks assignment-focused questions in real time.",
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
          "AI captures and scores visual checkpoints while a worker demonstrates quality, finishing, and precision.",
        icon: ShieldCheck,
        testId: "feature-snapshot-assessment",
      },
    ],
  },
  hi: {
    kicker: "\u0930\u093f\u092f\u0932-\u091f\u093e\u0907\u092e \u0935\u0930\u094d\u0915\u092b\u094b\u0930\u094d\u0938 \u0907\u0902\u091f\u0947\u0932\u093f\u091c\u0947\u0902\u0938",
    title: "\u0915\u093f\u0938\u0940 \u092d\u0940 \u0915\u094c\u0936\u0932 \u0915\u0947 \u0932\u093f\u090f \u0935\u0930\u094d\u0915\u0930 \u0915\u094b \u0932\u093e\u0907\u0935 AI voice + video evaluator \u0938\u0947 \u0938\u094d\u0915\u094d\u0930\u0940\u0928 \u0915\u0930\u0947\u0902\u0964",
    description:
      "Shramik \u091f\u0940\u092e\u094b\u0902 \u0915\u094b practical, assignment-based interview \u091a\u0932\u093e\u0928\u0947, objective scoring \u0926\u0947\u0928\u0947, \u0914\u0930 snapshot feedback \u0930\u093f\u0915\u0949\u0930\u094d\u0921 \u0915\u0930\u0928\u0947 \u092e\u0947\u0902 \u092e\u0926\u0926 \u0915\u0930\u0924\u093e \u0939\u0948\u0964",
    primaryCta: "\u0932\u093e\u0907\u0935 \u0938\u094d\u0915\u094d\u0930\u0940\u0928\u093f\u0902\u0917 \u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902",
    secondaryCta: "\u090f\u0921\u092e\u093f\u0928 \u0915\u092e\u093e\u0902\u0921 \u0938\u0947\u0902\u091f\u0930 \u0916\u094b\u0932\u0947\u0902",
    sideKicker: "\u0938\u094d\u0915\u094d\u0930\u0940\u0928\u093f\u0902\u0917 \u0938\u094d\u091f\u0948\u0902\u0921\u0930\u094d\u0921",
    sideTitle: "\u0905\u0938\u093e\u0907\u0928\u092e\u0947\u0902\u091f-\u092b\u0930\u094d\u0938\u094d\u091f \u0907\u0935\u0948\u0932\u094d\u092f\u0941\u090f\u0936\u0928\u0964",
    sideDescription:
      "AI practical \u0938\u0935\u093e\u0932 \u092a\u0942\u091b\u0924\u093e \u0939\u0948, confidence changes \u091f\u094d\u0930\u0948\u0915 \u0915\u0930\u0924\u093e \u0939\u0948, \u0914\u0930 snapshot-based quality notes \u0930\u093f\u0915\u0949\u0930\u094d\u0921 \u0915\u0930\u0924\u093e \u0939\u0948\u0964",
    heroAlt: "\u0915\u0941\u0936\u0932 \u0935\u0930\u094d\u0915\u0930 \u0935\u0930\u094d\u0915\u0938\u094d\u091f\u0947\u0936\u0928",
    sideAlt: "\u0935\u0930\u094d\u0915\u0930 practical assignment \u092a\u0930 \u091a\u0930\u094d\u091a\u093e \u0915\u0930\u0924\u093e \u0939\u0941\u0906",
    features: [
      {
        title: "\u0932\u093e\u0907\u0935 AI voice screening",
        description:
          "\u0939\u0930 worker \u0915\u094b practical voice interview \u092e\u093f\u0932\u0924\u093e \u0939\u0948 \u091c\u0939\u093e\u0902 AI real time \u092e\u0947\u0902 assignment-focused \u0938\u0935\u093e\u0932 \u092a\u0942\u091b\u0924\u093e \u0939\u0948\u0964",
        icon: Mic,
        testId: "feature-live-voice-screening",
      },
      {
        title: "\u0935\u0940\u0921\u093f\u092f\u094b presence + AI eye",
        description:
          "\u0935\u0930\u094d\u0915\u0930 \u0926\u0947\u0916 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902 \u0915\u093f AI actively observe \u0915\u0930 \u0930\u0939\u093e \u0939\u0948\u0964 \u0907\u0938\u0938\u0947 accountability \u0914\u0930 screening quality \u0926\u094b\u0928\u094b\u0902 \u092c\u0947\u0939\u0924\u0930 \u0939\u094b\u0924\u0940 \u0939\u0948\u0964",
        icon: Camera,
        testId: "feature-video-presence-ai-eye",
      },
      {
        title: "Snapshot skill assessment",
        description:
          "AI visual checkpoints capture \u0915\u0930\u0915\u0947 quality, finishing, \u0914\u0930 precision \u0915\u093e score \u0924\u0948\u092f\u093e\u0930 \u0915\u0930\u0924\u093e \u0939\u0948\u0964",
        icon: ShieldCheck,
        testId: "feature-snapshot-assessment",
      },
    ],
  },
};

export default function LandingPage() {
  const { locale } = useLanguage();
  const copy = landingCopy[locale] ?? landingCopy.en;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-8 md:gap-16 md:px-10 md:py-14">
      <section className="grid grid-cols-1 gap-6 md:grid-cols-12" data-testid="landing-hero-section">
        <article className="relative overflow-hidden rounded-[2rem] md:col-span-8" data-testid="landing-hero-card">
          <img src={heroImage} alt={copy.heroAlt} className="h-[55vw] min-h-[260px] max-h-[520px] w-full object-cover" data-testid="landing-hero-image" />
          <div className="hero-overlay absolute inset-0 p-6 md:p-10">
            <div className="flex h-full flex-col justify-end gap-5">
              <p className="text-sm uppercase tracking-[0.2em] text-white/85" data-testid="hero-kicker-text">
                {copy.kicker}
              </p>
              <h1 className="font-heading text-4xl leading-[0.92] text-white sm:text-5xl lg:text-6xl" data-testid="hero-main-heading">
                {copy.title}
              </h1>
              <p className="max-w-2xl text-sm text-white/90 md:text-base" data-testid="hero-description-text">
                {copy.description}
              </p>
              <div className="flex flex-wrap items-center gap-3 md:gap-4" data-testid="hero-cta-group">
                <Button asChild className="h-12 min-w-[160px] rounded-full px-8 text-base transition-transform duration-300 hover:scale-105 active:scale-95" data-testid="hero-start-screening-button">
                  <Link to="/screening">
                    {copy.primaryCta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="h-12 rounded-full bg-secondary/15 px-7 text-base text-white hover:bg-secondary/30 active:scale-95" data-testid="hero-open-admin-button">
                  <Link to="/admin">{copy.secondaryCta}</Link>
                </Button>
              </div>
            </div>
          </div>
        </article>

        <article className="soft-glass flex flex-col justify-between rounded-[2rem] p-6 md:col-span-4" data-testid="landing-right-highlight-card">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-primary" data-testid="right-card-tagline">
              {copy.sideKicker}
            </p>
            <h2 className="mt-3 font-heading text-3xl text-primary" data-testid="right-card-heading">
              {copy.sideTitle}
            </h2>
            <p className="mt-4 text-sm text-foreground/80" data-testid="right-card-description">
              {copy.sideDescription}
            </p>
          </div>
          <img src={workshopImage} alt={copy.sideAlt} className="mt-8 h-56 w-full rounded-2xl object-cover" data-testid="right-card-workshop-image" />
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3" data-testid="landing-features-grid">
        {copy.features.map((feature) => (
          <Card key={feature.title} className="rounded-3xl border-border/50 shadow-xl shadow-primary/5 transition-transform duration-300 hover:-translate-y-1" data-testid={feature.testId}>
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
