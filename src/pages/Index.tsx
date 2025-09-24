import Hero from "../components/Hero";
import Header from "../components/Header";
import Features from "../components/Features";
import Pricing from "../components/Pricing";
import CallToAction from "../components/CallToAction";
import Footer from "../components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <section id="features">
          <Features />
        </section>
        <section id="pricing">
          <Pricing />
        </section>
        <CallToAction />
      </main>
      <section id="contact">
        <Footer />
      </section>
    </div>
  );
};

export default Index;
