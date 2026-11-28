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
        <li><strong>Tolerancia cero</strong> con el contenido ofensivo, el acoso, lo sexual o violento y el spam. Cualquiera puede denunciar un mensaje, una comida o un perfil (mantené apretado el mensaje, la bandera de la comida o el botón del perfil) y bloquear a quien quiera. Revisamos cada denuncia en menos de 24 horas: borramos lo que no corresponde y, si se repite, la cuenta.</li>
        <li><strong>La cacona y el Bocha son un juego</strong> entre amigos para motivarse. Si a alguien le molesta, puede salir del grupo o crear uno sin Bocha.</li>
        <li><strong>La app es gratis</strong> y puede cambiar, sumar o quitar funciones. Hacemos lo posible para que ande siempre, pero no podemos garantizar que no falle ni que nunca se pierda información.</li>
        <li>Si cambian estos términos, te avisamos en Ajustes › Actualizaciones.</li>
      </ul>
    </div>
  );
}
