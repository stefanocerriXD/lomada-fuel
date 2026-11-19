import { Component } from "react";
import { RefreshCw } from "lucide-react";
import Logo from "./Logo.jsx";

// Si algo de adentro falla al cargar o al dibujarse, en vez de la pantalla en blanco: un aviso y "Recargar".
export default class Recuperable extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("Pantalla con error:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={this.props.completa ? "recuperable completa" : "recuperable"} role="alert">
        <Logo tam={48} />
        <strong>Algo no cargó</strong>
        <span>Puede ser la señal o una versión nueva de la app.</span>
        <button className="boton" onClick={() => window.location.reload()}><RefreshCw size={17} /> Recargar</button>
      </div>
    );
  }
}

// Mientras se baja una sección: el logo girando (igual que al abrir la app).
export function CargandoSeccion() {
  return (
    <div className="cargando-seccion" role="status" aria-label="Cargando">
      <span className="carga-logo" aria-hidden="true"><Logo tam={56} /></span>
    </div>
  );
}
