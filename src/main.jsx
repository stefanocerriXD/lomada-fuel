import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import App from "./App.jsx";
import { aplicarTema, leerTema } from "./lib/tema.js";
import "./styles.css";

aplicarTema(leerTema());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
