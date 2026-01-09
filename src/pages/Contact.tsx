import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Contact = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <section className="container py-12 md:py-16">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Contact</h1>
          <p className="mt-4 text-muted-foreground max-w-2xl">
            Need help with an order or have a question? Reach out and we’ll get back to you.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-6">
              <h2 className="font-semibold">Email</h2>
              <p className="mt-2 text-sm text-muted-foreground">support@trendmix.com</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-6">
              <h2 className="font-semibold">Phone</h2>
              <p className="mt-2 text-sm text-muted-foreground">+91 98765 43210</p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Contact;
