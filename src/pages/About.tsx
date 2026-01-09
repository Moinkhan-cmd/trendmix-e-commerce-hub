import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const About = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <section className="container py-12 md:py-16">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">About Us</h1>
          <p className="mt-4 text-muted-foreground max-w-2xl">
            TrendMix is your one-stop shop for trending beauty products, elegant jewelry, and stylish accessories.
          </p>
          <div className="mt-8 rounded-xl border border-border bg-background p-6">
            <p className="text-sm text-muted-foreground">
              This page is a placeholder. Add your brand story, mission, and policies here.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default About;
