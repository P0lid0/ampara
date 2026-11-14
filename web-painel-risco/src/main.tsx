import "@fontsource/manrope/400.css";
import "@fontsource/manrope/700.css";
import "./estilos.css";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("raiz")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
