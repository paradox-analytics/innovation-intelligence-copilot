import { Button } from "@/components/ui/button";
import {
  Brain,
  ChartNetwork,
  FileSearch,
  Network,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";

interface FeatureCard {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const features: FeatureCard[] = [
  {
    icon: <Brain className="h-8 w-8" />,
    title: "Multi-Agent AI",
    description:
      "Six specialized agents analyze your question from every angle -- research, support, skepticism, risk, trends, and executive synthesis.",
  },
  {
    icon: <Network className="h-8 w-8" />,
    title: "Knowledge Graph",
    description:
      "Dynamic entity graph maps technologies, companies, startups, patents, and market signals into an interconnected intelligence web.",
  },
  {
    icon: <ChartNetwork className="h-8 w-8" />,
    title: "Decision Intelligence",
    description:
      "Structured frameworks quantify confidence, surface contrarian evidence, and stress-test assumptions before strategic commitment.",
  },
  {
    icon: <FileSearch className="h-8 w-8" />,
    title: "Executive Reports",
    description:
      "Board-ready deliverables with clear recommendations, risk matrices, and evidence-backed strategic rationale.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Navigation */}
      <nav className="border-b border-border-default bg-bg-secondary/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-accent-blue" />
            <span className="text-lg font-bold text-text-primary">
              Innovation Intelligence Copilot
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/analyze"
              className="text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              Analysis
            </Link>
            <Link
              href="/documents"
              className="text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              Documents
            </Link>
            <Link
              href="/knowledge"
              className="text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              Knowledge
            </Link>
            <Link href="/analyze">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-accent-blue/5 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--color-accent-blue)_0%,_transparent_50%)] opacity-10" />

        <div className="relative mx-auto max-w-7xl px-6 py-32 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent-blue/30 bg-accent-blue/10 px-4 py-1.5 text-sm text-accent-blue">
              <Zap className="h-4 w-4" />
              AI-Powered Strategic Intelligence
            </div>
            <h1 className="text-5xl font-bold leading-tight tracking-tight text-text-primary sm:text-6xl">
              Innovation Intelligence
              <br />
              <span className="bg-gradient-to-r from-accent-blue to-accent-cyan bg-clip-text text-transparent">
                Copilot
              </span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-text-secondary sm:text-xl">
              Enterprise-grade AI advisory that synthesizes market intelligence,
              technology landscapes, and competitive dynamics into actionable
              strategic recommendations.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/analyze">
                <Button size="lg">
                  <Sparkles className="h-5 w-5" />
                  Start Analysis
                </Button>
              </Link>
              <Link href="/documents">
                <Button variant="outline" size="lg">
                  Upload Documents
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-border-default bg-bg-secondary/50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-text-primary">
              Strategic Decision Support
            </h2>
            <p className="mt-4 text-text-secondary">
              Six specialized AI agents collaborate to deliver comprehensive
              intelligence.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border-default bg-bg-secondary p-6 transition-all duration-300 hover:border-accent-blue/30 hover:shadow-lg hover:shadow-accent-blue/5"
              >
                <div className="mb-4 inline-flex rounded-lg bg-accent-blue/10 p-3 text-accent-blue transition-colors group-hover:bg-accent-blue/20">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-text-primary">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border-default py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-text-primary">
            Ready to transform your strategic process?
          </h2>
          <p className="mt-4 text-text-secondary">
            Upload your industry reports, ask strategic questions, and receive
            comprehensive intelligence briefings in minutes.
          </p>
          <div className="mt-8">
            <Link href="/analyze">
              <Button size="lg">
                <Sparkles className="h-5 w-5" />
                Start Analysis
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-default bg-bg-secondary py-8">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-text-muted">
          Innovation Intelligence Copilot -- Enterprise Technology Advisory
          Platform
        </div>
      </footer>
    </div>
  );
}
