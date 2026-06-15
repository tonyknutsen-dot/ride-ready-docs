import { lazy, Suspense, memo, useEffect } from "react";
import Hero from "../components/Hero";
import Header from "../components/Header";
import PageMeta from "../components/PageMeta";
import { trackFunnelEvent } from "@/lib/funnelTracking";

// Lazy load below-fold components for better performance
const EquipmentShowcase = lazy(() => import("../components/EquipmentShowcase"));
const Features = lazy(() => import("../components/Features"));
const Pricing = lazy(() => import("../components/Pricing"));
const CallToAction = lazy(() => import("../components/CallToAction"));
const Footer = lazy(() => import("../components/Footer"));

const SectionLoader = memo(() => (
  <div className="py-16 flex justify-center">
    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
));

const Index = memo(() => {
  useEffect(() => {
    trackFunnelEvent("landing_page_view");
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <PageMeta
        title="Ride Ready Docs | Ride Compliance Software"
        description="Manage ride checks, risk assessments, defect reports, maintenance records, wind and pressure logs, and share compliance documents in one platform."
        path="/"
      />
      <Header />
      <main>
        <Hero />
        <Suspense fallback={<SectionLoader />}>
          <EquipmentShowcase />
        </Suspense>
        <section id="features">
          <Suspense fallback={<SectionLoader />}>
            <Features />
          </Suspense>
        </section>
        <section id="pricing">
          <Suspense fallback={<SectionLoader />}>
            <Pricing />
          </Suspense>
        </section>
        <Suspense fallback={<SectionLoader />}>
          <CallToAction />
        </Suspense>
      </main>
      <section id="contact">
        <Suspense fallback={<SectionLoader />}>
          <Footer />
        </Suspense>
      </section>
    </div>
  );
});

Index.displayName = 'Index';

export default Index;

