import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/poppins/latin-800.css";
import App from "./App.jsx";
import { aplicarTema, leerTema } from "./lib/tema.js";
import { recargarUnaVez } from "./lib/perezosa.js";
import Recuperable from "./componentes/Recuperable.jsx";
import "./styles.css";

aplicarTema(leerTema());

// Vite avisa cuando no encuentra un archivo de la versión anterior (se publicó una nueva con la app abierta).
window.addEventListener("vite:preloadError", (e) => {
  if (recargarUnaVez()) e.preventDefault();
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Recuperable completa>
      <App />
    </Recuperable>
  </React.StrictMode>,
);
