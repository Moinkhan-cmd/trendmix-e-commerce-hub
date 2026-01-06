import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ShopProvider } from "./store/shop";
import { ThemeProvider } from "./hooks/use-theme";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="system" storageKey="trendmix-ui-theme">
    <ShopProvider>
      <App />
    </ShopProvider>
  </ThemeProvider>,
);
