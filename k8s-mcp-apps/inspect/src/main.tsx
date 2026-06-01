import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { globalBaseStyles } from "../../shared/theme";
import { App } from "./App";

// Inject shared global styles
const styleEl = document.createElement("style");
styleEl.textContent = globalBaseStyles;
document.head.appendChild(styleEl);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
