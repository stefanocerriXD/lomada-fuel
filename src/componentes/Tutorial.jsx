const SECCIONES = [
  {
    titulo: "Cargar comidas",
    preguntas: [
      ["¿Cómo subo una comida?", "Tocá el botón + o el + de la comida en Resumen. Escribí qué comiste, elegí el resultado y tocá Publicar. La foto es opcional."],
      ["¿Cómo cambio la medida de un alimento?", "Después de agregarlo, usá los botones − y + o escribí la cantidad. En el desplegable elegís unidad, cucharada, porción o gramos, y las calorías se recalculan solas."],
      ["¿Puedo repetir algo que ya comí?", "Sí. Al abrir Subir comida aparecen tus recientes y los que más usás. Al buscar, primero salen tus alimentos con la última cantidad que usaste."],
      ["No encuentro un producto. ¿Qué hago?", "Tocá Buscar en productos de supermercado, escaneá el código de barras con el botón de al lado, o usá el lápiz para cargarlo a mano."],
      ["¿Cómo edito o borro algo que cargué?", "Tocá tu inicial arriba a la derecha, entrá a Días, abrí el día y tocá el lápiz de la comida. Para borrarla, entrá a Más opciones."],
      ["¿Puedo subir una comida sin que la vea el grupo?", "Sí. Antes de publicar, abrí Más opciones y activá Solo para mí. Si querés que todas sean así, cambialo en Ajustes, en Privacidad."],
      ["¿Qué son las favoritas?", "Son comidas que guardás para repetirlas rápido. Tocá Favorita en tu foto, dentro de Imágenes. Después aparecen al abrir Subir comida."],
    ],
  },
  {
    titulo: "Importar de otra app",
    preguntas: [
      ["¿Cómo importo una comida?", "Copiá la captura o el texto en tu otra app. Después, en Lomada Fuel, tocá el + de esa comida, Importar y Pegar. También podés usar Subir captura."],
      ["¿Carga cada alimento por separado?", "Sí, cuando en la captura o el texto se ve cada alimento con su cantidad y calorías. Si tiene los gramos, después podés cambiar la cantidad."],
      ["¿Qué significa estimado?", "Tu otra app no mostraba los macros de ese alimento y los calculamos con nuestra lista. Son aproximados: si los necesitás exactos, usá una captura donde se vean."],
      ["¿Cómo importo todo el día?", "En Resumen tocá Importar el día, o Todo el día dentro de Subir comida. Si la captura separa las comidas, se cargan una por una. Al guardar te ofrece subir las fotos."],
      ["¿Las fotos del día suman calorías?", "No. Las calorías ya entraron con lo importado: la foto solo se publica en Imágenes."],
      ["Leyó mal un número. ¿Lo puedo corregir?", "Sí. Siempre podés revisar antes de guardar. Si tenés la opción, pegar el texto es más preciso que una captura. Para las capturas conviene una imagen nítida, sin recortar los números."],
      ["Si importo dos veces el mismo día, ¿se duplica?", "No. Lo importado antes para ese día o esa comida se reemplaza."],
      ["¿Mi captura se sube a algún lado?", "No. Se lee dentro de tu celular y no se guarda. La primera vez puede tardar porque baja el lector."],
    ],
  },
  {
    titulo: "Grupo",
    preguntas: [
      ["¿Dónde están las fotos del grupo?", "En Grupo, arriba, elegí Imágenes. Están separadas por desayuno, almuerzo, merienda y cena. Tocá una comida para abrirla."],
      ["¿Me puedo mover deslizando?", "Sí. Deslizá de costado para pasar entre Resumen, Chat, Imágenes, Retos y Ajustes. En una foto abierta, deslizá de costado para ver la siguiente y hacia abajo para cerrarla."],
      ["¿Cómo veo otro día?", "En Imágenes, usá la tira de días o las flechas. Con las flechas podés ir tan atrás como quieras."],
      ["¿Cómo veo qué comió cada uno?", "Tocá Ver alimentos debajo de la foto: aparece cada alimento con su cantidad y sus macros."],
      ["¿Cómo respondo o reacciono a un mensaje?", "Mantené apretado el mensaje: arriba elegís la reacción y abajo Responder o Copiar."],
      ["¿Puedo mandar fotos, GIF o stickers?", "Sí. En el chat, el botón de la imagen manda una foto o un GIF de tu galería, y la carita abre los stickers."],
      ["¿Cómo sé quién vio mi mensaje?", "Debajo de tu último mensaje aparece quién lo vio."],
      ["¿Cómo menciono a alguien?", "En el chat escribí @ y elegí a la persona. Le llega un aviso que dice que la mencionaste."],
      ["¿Cómo respondo una foto?", "Tocá Responder en el chat, debajo de la foto o al abrirla. Te lleva al chat con la foto citada: escribí y enviá."],
      ["¿Cómo entro al perfil de alguien?", "Tocá su nombre o su inicial, o el botón de personas al lado de Chat e Imágenes. Ahí están sus estadísticas, días, fotos y logros."],
    ],
  },
  {
    titulo: "Plan y progreso",
    preguntas: [
      ["¿Cómo calcula cuánto quemo?", "Usa tu edad, altura, peso y actividad para estimarlo. Con el tiempo lo ajusta según tus pesajes y lo que registrás."],
      ["¿Cómo actualizo mi plan?", "Entrá a Resumen, pestaña Progreso, y tocá Editar plan."],
      ["¿Qué significa lo que falta de cada macro?", "En Resumen ves cuántos gramos de proteínas, carbos y grasas te quedan para llegar a tu plan de hoy. Si aparece con un +, ya te pasaste por esa cantidad."],
      ["¿Qué hace ¿Qué como?", "Mira lo que te falta para tu meta del día y te propone recetas simples, con cantidades ajustadas. Tocá una para cargarla."],
    ],
  },
  {
    titulo: "Retos y logros",
    preguntas: [
      ["¿Cómo armo un reto?", "En Retos tocá Nuevo, elegí el tipo y los días. Participa todo el grupo."],
      ["¿Cómo se ganan los logros?", "Solos, a medida que usás la app. Cada logro tiene 5 niveles y cada nivel da un título mejor: por ejemplo, con 5 milanesas sos Bebé de la milanesa y con 250, Rey de la milanesa."],
      ["¿Dónde veo cuánto me falta?", "En Retos, tocá cualquier logro: ves la barra de avance, cuánto falta y todos sus niveles."],
      ["¿Qué es el nivel de cada uno?", "Cada nivel de cada logro suma un punto, y ese total es tu nivel general. Lo ves en Retos, en los perfiles y en Integrantes."],
      ["¿Las comidas privadas cuentan?", "No para los logros de Alimentación, porque esos los ve el grupo."],
    ],
  },
  {
    titulo: "Notificaciones",
    preguntas: [
      ["¿Cómo las activo en iPhone?", "Abrí la app en Safari, tocá Compartir y Agregar a inicio. Después entrá desde ese ícono y activalas en Notificaciones, acá en Ajustes."],
      ["¿Cómo las activo en Android?", "Abrí la app en Chrome y activalas en Notificaciones, acá en Ajustes."],
      ["¿Qué avisos automáticos hay?", "A las 21 te recuerda cargar tus comidas si todavía no cargaste el día. Cada lunes a las 9 llegan los podios de la semana, que quedan en el chat. Los domingos a las 9 llega el Match Day, antes del partido."],
      ["No me llegan. ¿Qué reviso?", "Fijate que el permiso esté activo en tu celular y que no estés en modo No molestar. En iPhone, usá siempre el ícono de inicio."],
    ],
  },
  {
    titulo: "Apple Salud y WHOOP",
    preguntas: [
      ["¿Cómo traigo lo que tengo en Apple Salud?", "En Ajustes, en Apple Salud: creá tu llave, instalá el Atajo y pegala cuando la pida. Después dejalo automático todas las noches."],
      ["¿Por qué WHOOP no me pasa lo que comí?", "WHOOP no ofrece esos datos a otras apps. Solo entrega recuperación, sueño, esfuerzo y calorías quemadas. Lo que comés se toma de Apple Salud."],
      ["¿Se suma con lo que cargo en la app?", "No. Lo de Apple Salud y lo que cargás acá quedan guardados por separado, y por defecto el total del día es el de Salud. En Ajustes, en Apple Salud, podés elegir usar el valor mayor o sumar todo."],
      ["¿Trae cada alimento desde Apple Salud?", "No: Salud solo le pasa a la app los totales del día. Para tener cada alimento con su cantidad y macros, importá la captura o el texto de tu app de comidas."],
    ],
  },
  {
    titulo: "Cuenta y privacidad",
    preguntas: [
      ["¿Qué ve el grupo de mí?", "Tu nombre, tu meta, tus comidas con fotos y macros, tu agua y tus logros. No ve tu peso, altura, edad, objetivo, favoritas ni datos de WHOOP."],
      ["¿Cómo pido una mejora?", "En Ajustes, en Mejoras, contá qué cambiarías y tocá Enviar pedido."],
      ["¿Cómo la dejo como app en el celular?", "En iPhone: Safari, Compartir y Agregar a inicio. En Android: menú de Chrome y Agregar a la pantalla principal."],
    ],
  },
];

export default function Tutorial() {
  return (
    <section className="tarjeta ajuste tutorial">
      <h2>Tutorial</h2>
      <p className="ajuste-texto">Elegí un tema y tocá la pregunta.</p>
      {SECCIONES.map((s) => (
        <details key={s.titulo} className="tutorial-seccion">
          <summary>{s.titulo}</summary>
          <div className="tutorial-preguntas">
            {s.preguntas.map(([pregunta, respuesta]) => (
              <details key={pregunta} className="tutorial-pregunta">
                <summary>{pregunta}</summary>
                <p>{respuesta}</p>
              </details>
            ))}
          </div>
        </details>
      ))}
    </section>
  );
}
