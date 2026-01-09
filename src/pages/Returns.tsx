import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Returns = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <section className="container py-12 md:py-16">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Returns</h1>
          <p className="mt-4 text-muted-foreground max-w-2xl">
            If something isn’t right, we’ll help you with a return or exchange.
          </p>
          <div className="mt-8 rounded-xl border border-border bg-background p-6">
            <p className="text-sm text-muted-foreground">
              This page is a placeholder. Add your returns window, condition requirements, and refund process here.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Returns;
