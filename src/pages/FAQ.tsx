import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const FAQ = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <section className="container py-12 md:py-16">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">FAQ</h1>
          <p className="mt-4 text-muted-foreground max-w-2xl">
            Answers to common questions about orders, shipping, and returns.
          </p>
          <div className="mt-8 rounded-xl border border-border bg-background p-6">
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium">Where can I track my order?</p>
                <p className="mt-1 text-muted-foreground">Use the Track Order page to view your order status.</p>
              </div>
              <div>
                <p className="font-medium">Do you offer returns?</p>
                <p className="mt-1 text-muted-foreground">Yes—see the Returns page for details.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default FAQ;
