const SECCIONES = [
  {
    titulo: "La caca 💩",
    preguntas: [
      ["¿Cuál es la regla?", "Mínimo 1 foto de comida por día. La foto del resumen del día no cuenta. Se cuenta a la medianoche."],
      ["¿Qué pasa si un día no subo ninguna?", ["Al día siguiente tenés 💩 al lado del nombre, y la ve todo el grupo.", "Te cae la maldición del Bocha: aparece al abrir la app, se asoma por los bordes, se ríe y te mancha la pantalla de caca.", "Ves borrosas las fotos del grupo, no podés reaccionar y en el chat solo podés mandar texto.", "El bot cuenta en el chat quiénes no subieron."]],
      ["¿Puedo limpiar la caca de la pantalla?", "Sí, y es rápido. Tocá Limpiar, abajo a la izquierda, y tocá o frotá cada mancha: con dos toques se va."],
      ["¿Cómo me saco al Bocha?", "Subiendo tu foto del día. Se van el Bocha, las manchas y las restricciones. La 💩 al lado del nombre queda hasta el día siguiente."],
      ["¿Qué es el Bocha Evo?", ["El domingo a la noche, el que más maldiciones juntó en la semana se come al BOCHA EVO de lunes a domingo. Si hay empate, le toca a todos los empatados.", "La app se le pone marrón, le aparecen más manchas de caca y el Bocha Evo se asoma más seguido.", "El teclado del chat queda tapado de caca: no puede mandar mensajes en toda la semana.", "Cargar comidas sigue funcionando, para no sumar más cacas."]],
      ["¿Me avisan antes?", "Sí. A las 22 te llega una notificación si todavía no subiste ninguna foto ese día. En Resumen, arriba, ves si ya subiste la de hoy."],
      ["¿Por qué no escucho al Bocha?", "En iPhone los sonidos suenan después de tocar algo en la app y no suenan con el celular en silencio."],
    ],
  },
  {
    titulo: "Cargar comidas",
    preguntas: [
      ["¿Cómo subo una comida?", "Tocá el botón + o el + de la comida en Resumen. Escribí qué comiste, elegí el resultado y tocá Publicar. La foto es opcional."],
      ["¿Cómo cambio la medida de un alimento?", "Después de agregarlo, usá los botones − y + o escribí la cantidad. En el desplegable elegís unidad, cucharada, porción o gramos, y las calorías se recalculan solas."],
      ["¿Cómo cambio mi objetivo o mis macros?", ["Andá a Ajustes, Perfil y tocá Editar mi plan.", "En Tu objetivo elegí Definir, Mantener o Bulkear. Al definir y al bulkear sube la proteína.", "En Tu plan elegí qué priorizás: equilibrado, más proteína o más carbos.", "Si querés números exactos, prendé Poner mis macros a medida y escribí los gramos de proteína, carbos y grasas. Tu meta de calorías sale de esos gramos."]],
      ["¿Cómo publico una comida grupal?", ["Cargá la comida como siempre, con foto y alimentos.", "Abajo, en ¿Comiste con alguien?, tocá a los que comieron con vos y publicá.", "A cada uno le llega una solicitud. Cuando la acepta desde Resumen, la comida se suma a su día con los mismos alimentos.", "Después cada uno puede tocar su comida y ajustar su porción sin cambiar la de los demás."]],
      ["¿Cómo guardo una receta mía, como un budín?", ["Andá a Ajustes, Mis recetas, y tocá Nueva receta.", "Poné el nombre y en cuántas porciones la dividís.", "Agregá cada ingrediente con su cantidad, igual que cuando cargás una comida.", "Si la pesás terminada, poné el peso: el horno le saca agua y así cada porción queda más exacta.", "La próxima vez, al cargar una comida buscala por el nombre y elegí cuántas porciones comiste."]],
      ["¿Qué son las colaciones?", "Lo que comés entre comidas: una fruta, una barrita, un puñado de frutos secos. Tocá el + de Colaciones y cargá cada una cuando la comas; podés cargar varias en el mismo día y todas suman al total."],
      ["¿Puedo repetir una comida completa de otro día?", "Sí. Al tocar el + de desayuno, almuerzo, merienda, cena o colaciones aparecen tus comidas anteriores de ese momento. Tocá una y se cargan todos sus alimentos con las mismas cantidades; después podés cambiar lo que quieras."],
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
      ["¿Dónde están las fotos del grupo?", "En Grupo, arriba, elegí Imágenes. Están separadas por desayuno, almuerzo, merienda, cena y colaciones. Tocá una comida para abrirla."],
      ["¿Me puedo mover deslizando?", "Sí. Deslizá de costado para pasar entre Resumen, Chat, Imágenes, Logros y Ajustes. En una foto abierta, deslizá de costado para ver la siguiente y hacia abajo para cerrarla."],
      ["¿Cómo veo otro día?", "En Imágenes, usá la tira de días o las flechas. Con las flechas podés ir tan atrás como quieras."],
      ["¿Cómo veo qué comió cada uno?", "Tocá Ver alimentos debajo de la foto: aparece cada alimento con su cantidad y sus macros."],
      ["¿Cómo respondo o reacciono a un mensaje?", "Para responder, deslizá el mensaje hacia la derecha. Para reaccionar o copiar, mantenelo apretado y soltá: se abren las opciones."],
      ["¿Puedo mandar fotos, GIF o stickers?", "Sí. En el chat, el botón de la imagen manda fotos o GIF de tu galería, varias juntas si querés, y la carita abre los stickers."],
      ["¿Cómo sé quién vio un mensaje?", "Debajo de cada mensaje aparece quién lo vio: cada persona queda en el último mensaje que leyó."],
      ["¿Puedo mandar audios?", "Sí. Con el campo vacío aparece el micrófono: tocalo para grabar y tocá enviar cuando termines, o el tacho para descartarlo. La primera vez el celular pide permiso."],
      ["¿Qué es \"está escribiendo\"?", "Mientras alguien escribe en el chat o arma una comida para publicar, lo ves arriba en vivo."],
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
    titulo: "Logros",
    preguntas: [
      ["¿Cómo se ganan los logros?", "Solos, a medida que usás la app. Cada logro tiene 5 niveles y cada nivel da un título mejor: por ejemplo, con 5 milanesas sos Bebé de la milanesa y con 250, Rey de la milanesa."],
      ["¿Dónde veo cuánto me falta?", "En Logros, tocá cualquiera: ves la barra de avance, cuánto falta y todos sus niveles."],
      ["¿Qué es el nivel de cada uno?", "Cada nivel de cada logro suma un punto, y ese total es tu nivel general. Lo ves en Logros, en los perfiles y en Integrantes."],
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
      ["¿Qué necesito para conectar Apple Salud?", "Un iPhone y que tus comidas lleguen a la app Salud, por ejemplo desde MyFitnessPal u otra app que escriba en Salud. Si cargás todo directo en Lomada Fuel, no hace falta conectar nada."],
      ["¿Cómo conecto Apple Salud? (paso a paso)", [
        "En Lomada Fuel, entrá a Ajustes y bajá hasta Apple Salud. Tocá Crear mi llave: se copia sola. Es personal, no la compartas.",
        "En el mismo lugar tocá Instalar Atajo. Se abre la app Atajos: tocá Agregar atajo.",
        "En Atajos, tocá el atajo Lomada fuel para abrirlo. Bajá hasta Obtener contenido de URL y buscá la fila token. Tocá el lado derecho, que está vacío, y pegá tu llave. Tocá OK arriba.",
        "Probalo una vez a mano: tocá ▶ abajo. La primera vez te pide permiso para leer Salud: aceptá. Tiene que aparecer un texto que dice \"ok\": true.",
        "Fijate en Resumen de Lomada Fuel: aparece Resumen de Apple Salud con tus calorías de hoy.",
        "Dejalo automático: en Atajos, tocá Automatización abajo y después +. Elegí App, tocá Elegir y marcá la app donde cargás tus comidas (o Salud). Marcá Se cierra y desmarcá Se abre. Elegí Ejecutar inmediatamente, tocá Siguiente y elegí Lomada fuel.",
        "Si querés, sumá otra automatización con Hora del día (por ejemplo 23:30, Diariamente, Ejecutar inmediatamente) para cerrar el día aunque no abras tu app.",
      ]],
      ["¿Cómo funciona una vez conectado?", [
        "Cada vez que cerrás tu app de comidas, el Atajo corre solo en segundo plano y manda las calorías y los macros de hoy. No te saca de ninguna app.",
        "En Resumen aparece como Resumen de Apple Salud. Si se actualiza varias veces en el día, reemplaza el dato anterior: no lo suma.",
        "Por defecto el total del día es el de Salud, así no cuenta doble con lo que cargues en Lomada Fuel. Lo podés cambiar en Ajustes, en Apple Salud.",
        "El grupo ve tu total en El día de cada uno, y cuenta para retos, logros y podios. No aparece en Imágenes ni en el chat porque no tiene foto.",
      ]],
      ["No se actualiza. ¿Qué reviso?", [
        "Que el campo token del Atajo tenga tu llave. Si creaste otra llave, la anterior deja de servir: pegá la nueva.",
        "Que hayas aceptado el permiso de Salud: corré el Atajo una vez a mano con ▶.",
        "Que la automatización diga Ejecutar inmediatamente; si no, iPhone te pregunta y no corre solo.",
        "Que tus comidas estén en la app Salud: abrí Salud, Explorar, Nutrición, y fijate en Ingesta calórica.",
      ]],
      ["¿Por qué WHOOP no me pasa lo que comí?", "WHOOP no ofrece esos datos a otras apps. Solo entrega recuperación, sueño, esfuerzo y calorías quemadas. Lo que comés se toma de Apple Salud."],
      ["¿Se suma con lo que cargo en la app?", "No. Lo de Apple Salud y lo que cargás acá quedan guardados por separado, y por defecto cuenta el mayor de los dos: si cargás una comida acá que no está en Salud, se suma. En Ajustes, en Apple Salud, podés elegir usar el valor mayor o sumar todo."],
      ["¿Trae cada alimento desde Apple Salud?", "No: Salud solo le pasa a la app los totales del día. Para tener cada alimento con su cantidad y macros, importá la captura o el texto de tu app de comidas."],
    ],
  },
  {
    titulo: "Cuenta y privacidad",
    preguntas: [
      ["¿Qué ve el grupo de mí?", "Tu nombre, tu meta, tus comidas con fotos y macros, tu agua y tus logros. No ve tu peso, altura, edad, objetivo, favoritas ni datos de WHOOP."],
      ["¿Cómo pido una mejora?", "En Ajustes, en Mejoras, contá qué cambiarías y tocá Enviar pedido."],
      ["¿Cómo la dejo como app en el celular?", "En iPhone: Safari, Compartir y Agregar a inicio. En Android: menú de Chrome y Agregar a la pantalla principal. Mientras la uses desde el navegador vas a ver un cartel arriba que te lo recuerda; desaparece cuando la abrís como app."],
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
                {Array.isArray(respuesta)
                  ? <ol className="tutorial-pasos">{respuesta.map((paso) => <li key={paso}>{paso}</li>)}</ol>
                  : <p>{respuesta}</p>}
              </details>
            ))}
          </div>
        </details>
      ))}
    </section>
  );
}
