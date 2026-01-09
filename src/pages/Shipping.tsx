import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Shipping = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <section className="container py-12 md:py-16">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Shipping Info</h1>
          <p className="mt-4 text-muted-foreground max-w-2xl">
            Shipping timelines and costs vary by location and carrier.
          </p>
          <div className="mt-8 rounded-xl border border-border bg-background p-6">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Processing: 1–2 business days</li>
              <li>Delivery: depends on your location</li>
              <li>Tracking: available for most orders</li>
            </ul>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Shipping;
