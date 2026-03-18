import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { Nav } from "./components/Nav";

const root = document.getElementById("root");
if (!root) throw new Error("No root element");

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <Nav />
      <AppRoutes />
    </HashRouter>
  </StrictMode>,
);
