import { ReactNode } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PageMeta from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export interface SeoLandingSection {
  heading: string;
  body: string;
  bullets?: string[];
}

interface SeoLandingPageProps {
  path: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  sections: SeoLandingSection[];
  closingHeading?: string;
  closingBody?: string;
  /** Optional JSON-LD object */
  jsonLd?: Record<string, unknown>;
  /** Optional extra content slot above the final CTA */
  extra?: ReactNode;
}

/**
 * Reusable public SEO landing-page template.
 * Mobile-first, indexable, self-canonical, with CTAs to Start Free Trial
 * (/auth) and See How It Works (/how-it-works).
 */
const SeoLandingPage = ({
  path,
  metaTitle,
  metaDescription,
  h1,
  intro,
  sections,
  closingHeading,
  closingBody,
  jsonLd,
  extra,
}: SeoLandingPageProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PageMeta title={metaTitle} description={metaDescription} path={path} />
      {jsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <Header />

      <main className="flex-1 pt-24 pb-16">
        {/* Hero */}
        <section className="container mx-auto px-4 md:px-6 max-w-4xl">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">
            {h1}
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed">
            {intro}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/how-it-works">See How It Works</Link>
            </Button>
          </div>
        </section>

        {/* Sections */}
        <section className="container mx-auto px-4 md:px-6 max-w-4xl mt-14 space-y-6">
          {sections.map((s) => (
            <Card key={s.heading}>
              <CardContent className="p-6 md:p-8">
                <h2 className="text-xl md:text-2xl font-semibold text-foreground">
                  {s.heading}
                </h2>
                <p className="mt-3 text-muted-foreground leading-relaxed">{s.body}</p>
                {s.bullets && s.bullets.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-foreground">
                        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </section>

        {extra && (
          <section className="container mx-auto px-4 md:px-6 max-w-4xl mt-10">
            {extra}
          </section>
        )}

        {/* Closing CTA */}
        {(closingHeading || closingBody) && (
          <section className="container mx-auto px-4 md:px-6 max-w-3xl mt-14 text-center">
            {closingHeading && (
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                {closingHeading}
              </h2>
            )}
            {closingBody && (
              <p className="mt-4 text-muted-foreground leading-relaxed">
                {closingBody}
              </p>
            )}
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg">
                <Link to="/auth">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/how-it-works">See How It Works</Link>
              </Button>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default SeoLandingPage;
