// Política de privacidad y términos de uso. Se ven desde el login y desde Ajustes › Privacidad y términos.
// Si cambia qué datos se guardan o a quién se mandan, actualizar este texto y la fecha.
export const ACTUALIZADO = "18 de noviembre de 2026";

export default function PrivacidadTerminos() {
  return (
    <div className="legal">
      <p className="legal-fecha">Última actualización: {ACTUALIZADO}</p>

      <h3>Privacidad</h3>
      <p>Lomada Fuel es una app para registrar lo que comés con tu grupo de amigos. Acá te contamos qué datos guardamos, para qué y qué podés hacer con ellos.</p>

      <h4>Qué guardamos</h4>
      <ul>
        <li><strong>Tu cuenta:</strong> usuario, mail y contraseña (cifrada: nadie puede verla).</li>
        <li><strong>Tu perfil y tu plan:</strong> nombre, color, edad, sexo, altura, peso, objetivo y nivel de actividad. Sirven para calcular tu meta de calorías y macros.</li>
        <li><strong>Lo que cargás:</strong> comidas, fotos, pesos, agua, ayunos, registros diarios, recordatorios, recetas, viaje y Match Day.</li>
        <li><strong>El grupo:</strong> mensajes del chat, audios, fotos, reacciones y comentarios.</li>
        <li><strong>Lo que conectás vos:</strong> si usás Apple Salud o WHOOP, las calorías, macros, recuperación y sueño que nos mandan.</li>
        <li><strong>Avisos:</strong> el permiso de tu celular para mandarte notificaciones.</li>
      </ul>

      <h4>Quién lo ve</h4>
      <ul>
        <li>Tu grupo ve tu nombre, tus comidas con sus fotos, tus logros y lo que escribís en el chat. Las comidas que marcás como privadas solo las ves vos.</li>
        <li>Tu peso, tu plan y tus datos de salud son solo tuyos: el grupo no los ve.</li>
        <li>Los productos que escaneás o cargás de una etiqueta (nombre, marca y valores) quedan en un catálogo que usa toda la app, sin decir quién los cargó.</li>
        <li>No vendemos tus datos ni los usamos para publicidad.</li>
      </ul>

      <h4>Con qué servicios funciona</h4>
      <ul>
        <li><strong>Supabase:</strong> guarda la base de datos y las fotos.</li>
        <li><strong>Vercel:</strong> aloja la app.</li>
        <li><strong>Google Gemini (IA):</strong> cuando usás el reconocimiento de fotos, etiquetas o capturas, esa imagen se manda a Google para leerla. Usamos el servicio gratuito, y Google puede usar lo que recibe para mejorar sus productos. Si no querés, cargá las comidas a mano.</li>
        <li><strong>Open Food Facts y USDA:</strong> bases públicas de alimentos. Solo les mandamos lo que buscás o el código de barras, nunca tus datos.</li>
      </ul>

      <h4>Cuánto tiempo</h4>
      <p>Mientras tengas tu cuenta. Si la borrás, se borra todo lo tuyo. Podemos tener copias de seguridad por hasta dos meses; tu información desaparece de ellas cuando vencen.</p>

      <h4>Tus derechos</h4>
      <ul>
        <li><strong>Ver y llevarte tus datos:</strong> Ajustes › Cuenta › Descargar mis datos.</li>
        <li><strong>Corregirlos:</strong> desde tu perfil o editando cada carga.</li>
        <li><strong>Borrarlos:</strong> Ajustes › Cuenta › Borrar mi cuenta.</li>
      </ul>
      <p>Para cualquier consulta, escribinos desde Ajustes › Mejoras. Si no te respondemos, podés reclamar ante la Agencia de Acceso a la Información Pública (AAIP), que controla el cumplimiento de la Ley 25.326 de Protección de Datos Personales.</p>

      <h3>Términos de uso</h3>
      <ul>
        <li><strong>No es consejo médico.</strong> Las calorías, los macros y las metas son estimaciones. Para una dieta o un tratamiento, consultá a un profesional de la salud.</li>
        <li><strong>Edad:</strong> para usar la app tenés que tener 16 años o más.</li>
        <li><strong>Lo que subís es tuyo,</strong> pero sos responsable: nada ofensivo, ilegal ni fotos de otros sin su permiso. El admin del grupo puede sacar a alguien, y podemos borrar contenido o cuentas que no respeten esto.</li>
        <li><strong>La cacona y el Bocha son un juego</strong> entre amigos para motivarse. Si a alguien le molesta, puede salir del grupo o crear uno sin Bocha.</li>
        <li><strong>La app es gratis</strong> y puede cambiar, sumar o quitar funciones. Hacemos lo posible para que ande siempre, pero no podemos garantizar que no falle ni que nunca se pierda información.</li>
        <li>Si cambian estos términos, te avisamos en Ajustes › Actualizaciones.</li>
      </ul>
    </div>
  );
}
