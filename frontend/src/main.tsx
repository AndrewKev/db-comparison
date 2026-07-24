import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ComparisonPage } from "./pages/ComparisonPage";
import "./styles/global.css";
import "./monaco";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ComparisonPage />
  </StrictMode>,
);
