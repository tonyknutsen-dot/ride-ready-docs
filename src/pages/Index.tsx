import { lazy, Suspense } from "react";
import Hero from "../components/Hero";
import Header from "../components/Header";

// Lazy load below-fold components for better performance
const EquipmentShowcase = lazy(() => import("../components/EquipmentShowcase"));
const Features = lazy(() => import("../components/Features"));
const Pricing = lazy(() => import("../components/Pricing"));
const CallToAction = lazy(() => import("../components/CallToAction"));
const Footer = lazy(() => import("../components/Footer"));

// Minimal loading fallback
const SectionLoader = () => (
  <div className="py-16 flex justify-center">
    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
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
};

export default Index;
