import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Camera, CameraOff } from "lucide-react";

export default function Escaner({ onAlimento, buscar }) {
  const [camara, setCamara] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [estado, setEstado] = useState("");
  const [buscando, setBuscando] = useState(false);
  const video = useRef(null);

  async function consultar(valor) {
    setBuscando(true);
    setEstado("");
    try {
      const alimento = await buscar(valor);
      if (alimento) onAlimento(alimento);
      else setEstado(`El código ${valor} no está en la base o no tiene valores nutricionales. Cargalo a mano.`);
    } catch (err) {
      setEstado(err.message);
    } finally {
      setBuscando(false);
    }
  }

  useEffect(() => {
    if (!camara) return;
    let controles;
    let cancelado = false;
    (async () => {
      try {
        // Se carga recién acá: pesa bastante y la mayoría de las veces no se usa.
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const pistas = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]]]);
        const lector = new BrowserMultiFormatReader(pistas);
        if (cancelado) return;
        controles = await lector.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video.current,
          (resultado, _error, control) => {
            if (!resultado) return;
            control.stop();
            setCamara(false);
            const leido = resultado.getText();
            setCodigo(leido);
            consultar(leido);
          },
        );
        if (cancelado) controles.stop();
      } catch {
        setCamara(false);
        setEstado("No pudimos abrir la cámara. Escribí el número del código.");
      }
    })();
    return () => {
      cancelado = true;
      controles?.stop();
    };
  }, [camara]);

  function enviar(e) {
    e.preventDefault();
    const limpio = codigo.replace(/\D/g, "");
    if (limpio) consultar(limpio);
  }

  return (
    <motion.div className="tarjeta-interna" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
      {camara ? (
        <div className="visor">
          <video ref={video} muted playsInline />
          <motion.i animate={{ y: [-44, 44, -44] }} transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }} />
        </div>
      ) : null}
      <button type="button" className="boton boton-secundario" onClick={() => setCamara(!camara)}>
        {camara ? <><CameraOff size={17} /> Cerrar cámara</> : <><Camera size={17} /> Escanear con la cámara</>}
      </button>
      <form className="codigo-manual" onSubmit={enviar}>
        <input value={codigo} onChange={(e) => setCodigo(e.target.value)} inputMode="numeric" placeholder="O escribí el número" aria-label="Número de código de barras" />
        <button className="boton" type="submit" disabled={buscando || !codigo.trim()}>{buscando ? "Buscando…" : "Buscar"}</button>
      </form>
      {estado && <p className="nota">{estado}</p>}
    </motion.div>
  );
}
