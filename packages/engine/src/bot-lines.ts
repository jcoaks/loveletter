// Every line bots can say, by situation. Placeholders: {name} (the other player involved) and
// {card} (a card name). Lines are light-hearted and never rely on hidden information.
export const LINES = {
  // --- Inicio de ronda
  round_start_mine: [
    'Abro yo. Que nadie se asuste.',
    'Me toca empezar: ya voy calentando.',
    'Primera jugada mía, qué responsabilidad.',
    'Empiezo yo, y prometo no estropearlo demasiado.',
    'Arrancamos. Ojo con mi cara de póker.',
  ],
  round_start_other: [
    '{name} abre la ronda. Veamos qué inventa.',
    'Que empiece {name}, yo observo.',
    'Adelante, {name}, rómpenos el hielo.',
    'A ver con qué sale {name} esta vez.',
    'Nueva ronda: {name} al mando, por ahora.',
  ],
  round_start_two: [
    'Tres cartas boca arriba: eso ya no se las llevan.',
    'Mano a mano. Menos mal que vemos tres cartas fuera.',
    'Solo dos en la mesa, y tres cartas que ya sabemos que no están.',
    'Cara a cara: aquí no hay a quién echarle la culpa.',
  ],
  round_start_later: [
    'Otra ronda, otra oportunidad.',
    'Se barajan las cartas y se reparten las esperanzas.',
    'Esta ronda me siento con suerte. Como todas.',
    'A repartir de nuevo, que la última ya pasó.',
  ],
  // --- Espía
  spy_first_mine: [
    'Un Espía a su servicio.',
    'Yo no hice nada, lo juro.',
    'Tengo ojos en todas partes.',
    'Misión secreta en marcha. No pregunten.',
  ],
  spy_first_other: [
    '¿Un Espía? Qué sospechoso.',
    'Ese Espía va a dar de qué hablar.',
    '{name} juega al espía. Habrá que vigilarle.',
    'Un Espía en la mesa y yo sin gabardina.',
  ],
  spy_second_mine: [
    'Dos Espías míos. Soy una agencia entera.',
    'El segundo Espía: ya parezco un servicio secreto.',
    'Doble agente, a su disposición.',
    'Sí, otro Espía. No es manía, es estrategia.',
  ],
  spy_second_other: [
    '{name} con un segundo Espía. Ya es una red de espionaje.',
    '¿Otro Espía de {name}? Alguien tiene un club.',
    'Dos Espías de {name}: eso ya no es casualidad.',
    'A {name} los Espías le caen del cielo.',
  ],
  spy_competition_mine: [
    'Ahora hay competencia por la ficha del Espía.',
    'Dos espías en la mesa: ya no estoy solo.',
    'Alguien más se dedica al espionaje. Qué atrevimiento.',
    'Si hay dos espías, la ficha se nos esfuma.',
  ],
  spy_competition_other: [
    'Ahora hay competencia por la ficha del Espía.',
    'Dos espías en la mesa: a ver quién queda de pie.',
    'Ya hay dos espías aquí. Alguien va a salir sin ficha.',
    '{name} se mete en el negocio del espionaje.',
    'Con dos espías, la ficha se complica para todos.',
  ],
  spy_sole_mine: [
    'Me quedo como único espía. Ficha a la vista.',
    'El otro espía cayó. Ahora el secreto es solo mío.',
    'Espía solitario, pero con futuro.',
    'Mi competencia desapareció. Qué pena, qué pena.',
  ],
  spy_sole_other: [
    '{name} queda como único espía. Eso vale una ficha.',
    'Solo {name} conserva su espía: ojito con eso.',
    'Cayó un espía y {name} se queda con el negocio.',
    'Único espía en pie: {name}. Alguien debería detenerle.',
  ],
  spy_discarded_mine: [
    'Descartar mi Espía… bueno, algo es algo.',
    'Hasta mis espías me los quitan.',
    'Mi Espía en el suelo, y yo tan tranquilo.',
    'Ahí se va mi Espía. Que me cuente luego.',
  ],
  spy_discarded_other: [
    'El Príncipe le quitó el Espía a {name}.',
    '{name} descarta un Espía sin quererlo.',
    'Ese Espía de {name} no lo esperaba.',
    'Un Espía a la basura, cortesía del Príncipe.',
  ],
  // --- Guardia
  guard_hit_mine: [
    '¡{name}, te tengo! Sabía que eras {card}.',
    'Ni la bola de cristal es tan buena.',
    'Fue un presentimiento, de verdad.',
    '¡Directo al clavo!',
    'Lo vi venir. Bueno, lo adiviné.',
  ],
  guard_hit_on_me: [
    '¿Cómo supiste? Qué mala suerte.',
    'Me descubrieron… adiós, mesa.',
    'Hasta aquí llegué. Suerte a los demás.',
    'Ni tiempo me diste de disimular.',
    'Tenías que acertar justo hoy.',
  ],
  guard_hit_other: [
    'Qué puntería la de {name}.',
    'Uf, eso dolió.',
    'Cuidado con ese Guardia.',
    '{name} acertó y ahora presume en silencio.',
    'Eso no fue suerte. Bueno, un poco sí.',
  ],
  guard_miss_mine: [
    'Bueno, tenía que intentarlo.',
    'Era una apuesta y salió mal.',
    'Pensé que sí… qué cosa.',
    'Casi, casi.',
    'Fallé, pero con elegancia.',
  ],
  guard_miss_on_me: [
    'Ja, ni cerca.',
    'Casi me atrapas, pero no.',
    'Sigo aquí, para tu disgusto.',
    'Buen intento, de verdad.',
    'Esa no era, {name}. Sigue probando.',
  ],
  guard_miss_other: [
    'Se salvó por poco.',
    'Fallaste, qué lástima.',
    '{name} apuntó mal. Pasa hasta en las mejores familias.',
    'El Guardia se quedó sin premio.',
  ],
  guard_streak_mine: [
    'Otra vez fallé. Hoy no es mi día de adivino.',
    'Ya van varias que no acierto. Racha poco real.',
    'Mi intuición está de vacaciones.',
    'Voy fallando en serie, pero con constancia.',
  ],
  guard_streak_other: [
    '{name} lleva varios Guardias fallados seguidos.',
    'A {name} se le resiste la puntería.',
    'Otra acusación fallida de {name}. Esto ya es costumbre.',
    '{name}, quizá convenga cambiar de método.',
  ],
  guard_count_third: [
    'Ya van tres Guardias. Quedan pocos.',
    'Tercer Guardia de la ronda: la mesa está muy acusadora.',
    'Tres Guardias ya. Alguien repartió mucho.',
    'Cuenten conmigo: tres Guardias fuera.',
  ],
  guard_count_fourth: [
    'Cuatro Guardias en la mesa. Quedan dos, como mucho.',
    'Cuarto Guardia: la cuenta se pone interesante.',
    'Casi se acaban los Guardias.',
    'Cuatro Guardias y contando.',
  ],
  guard_count_many: [
    'Qué ronda tan llena de Guardias.',
    'Otro Guardia más: ya casi no quedan.',
    'Esto es una comisaría, no una mesa de juego.',
    'Si queda algún Guardia, que levante la mano.',
  ],
  // --- Sacerdote
  priest_mine: [
    'Hmm… interesante. Muy interesante.',
    'Ahora sé algo que ustedes no.',
    'Qué cosas se aprenden en esta mesa.',
    'Gracias por la información.',
    'Un vistazo y ya tengo plan.',
  ],
  priest_on_me: [
    'No miren mucho, que me pongo tímido.',
    'Qué curiosos.',
    'Mi mano es un libro cerrado… hasta ahora.',
    '¿Yo? Qué atrevido, {name}.',
    'Cotillea tranquilo, {name}, no hay mucho que ver.',
  ],
  priest_other: [
    'Todos quieren espiar a alguien.',
    'Ahí va una mirada indiscreta.',
    '{name} ya sabe algo que yo no. Eso no me gusta.',
    'Información privilegiada en la mesa.',
  ],
  // --- Barón
  baron_tie_involved: [
    'Empate. Nadie se mueve.',
    'Qué casualidad, iguales.',
    'Mismas cartas, mismo destino: ninguno.',
    'Ni tú ni yo. Tablas.',
    'Una comparación sin ganador. Qué diplomático.',
  ],
  baron_tie_other: [
    'Qué aburrido, empate.',
    'El Barón terminó en tablas.',
    'Cartas gemelas en esa comparación.',
    'Ni uno ni otro: el Barón se quedó sin víctima.',
  ],
  baron_won: [
    'Gané la comparación. Lo siento, no lo siento.',
    'La mía pesaba más.',
    '¡El Barón nunca falla!',
    'Una comparación a mi favor, qué gusto.',
    'Midieron cartas y salí ganando.',
  ],
  baron_lost: [
    'Mi carta no daba la talla…',
    'Perdí la comparación. Qué se le va a hacer.',
    'Hoy no es mi día.',
    'Me ganaron por una carta. Casi nada.',
    'Esa comparación me salió carísima.',
  ],
  baron_high_loser_mine: [
    'Caer con una carta tan alta… eso duele.',
    'Tenía una buena carta y aun así. Increíble.',
    'Mi carta era buena, pero la suya era mejor.',
    'Perder con carta alta: el colmo.',
  ],
  baron_high_loser_other: [
    '{name} cayó con una carta alta. Qué pena.',
    'Había una carta de mucho valor y se fue al suelo.',
    'Qué desperdicio de carta alta.',
    'Perder así, con tan buena mano, tiene mérito.',
  ],
  baron_other: [
    'El Barón no perdona.',
    'Una comparación muy reñida.',
    'Se midieron las cartas y alguien se llevó el disgusto.',
    'Comparar manos siempre acaba en drama.',
  ],
  // --- Doncella y sin objetivos
  protected_mine: [
    'Voy a estar a salvo un ratito.',
    'La Doncella cuida de mí.',
    'Intenten alcanzarme ahora.',
    'Me retiro al jardín por esta vuelta.',
    'A salvo, con té y todo.',
  ],
  protected_other: [
    'Qué conveniente la Doncella.',
    'Ya se escondió, qué listo.',
    'Hmm, se protege.',
    '{name} se fue a refugiar. Ya volverá.',
  ],
  protected_all: [
    '¿Y ahora a quién ataco? Está todo protegido.',
    'Todos blindados: esto parece un convento.',
    'Nadie al alcance. Qué mesa tan precavida.',
    'Con tanta Doncella no hay objetivos que valgan.',
    'Se acabó el blanco: todos a salvo.',
  ],
  no_targets_mine: [
    'Nadie al que apuntar. Qué silencio.',
    'Todos escondidos… jugada al aire.',
    '¿Y ahora a quién ataco? Nadie a la vista.',
    'Mi carta se quedó sin víctima.',
    'Juego al vacío y a lo que salga.',
  ],
  no_targets_other: [
    'Jugada en el vacío.',
    'Todos protegidos, qué mesa tan cobarde.',
    '{name} se quedó sin objetivos. Qué mala racha.',
    'Esa carta no encontró a nadie.',
  ],
  // --- Príncipe
  prince_princess_me: [
    '¡No, la Princesa!',
    'Mi pobre Princesa…',
    'Qué golpe tan cruel.',
    'Soltar la Princesa por culpa de un Príncipe. Ironías.',
  ],
  prince_princess_other: [
    '¡Princesa fuera! Qué desastre.',
    'Eso sí que no lo esperaba nadie.',
    'Una Princesa descartada: la realeza no es lo que era.',
    '{name} cae por culpa de su propia Princesa.',
    'Qué dramático final para {name}.',
  ],
  prince_mine_on_other: [
    'Descarta, descarta.',
    'Una carta nueva te hará bien.',
    'Corte de mano, nada personal.',
    'Un poco de renovación nunca viene mal, {name}.',
    'Tu mano estaba aburrida, la cambié.',
  ],
  prince_on_me: [
    'Ay, justo esa quería conservar.',
    'Pues a empezar de nuevo.',
    'Qué Príncipe tan entrometido.',
    '¿Yo? Qué atrevido, {name}.',
    'Me quitaron la carta. Qué modales.',
  ],
  prince_self_mine: [
    'Cambio de aires para mi mano.',
    'Me renuevo, que falta me hacía.',
    'Me descarto yo solo. Qué independencia.',
    'Hora de una carta nueva.',
  ],
  prince_self_other: [
    '{name} se descarta a sí mismo. Audaz.',
    '{name} se cambió la mano. Algo trama.',
    'El Príncipe de {name} apunta a casa.',
    'Auto-descarte de {name}: o genio o desesperación.',
  ],
  prince_other: [
    'Mmm, el Príncipe mueve la mesa.',
    'Una mano menos para la causa.',
    'Descarte real. Muy refinado.',
  ],
  // --- Canciller
  chancellor_mine: [
    'Tres cartas y una sola decisión.',
    'Déjenme pensar un momento…',
    'Más cartas, más problemas.',
    'Voy a elegir con cuidado.',
    'El Canciller me dio opciones. Qué amable.',
  ],
  chancellor_other: [
    'El Canciller piensa mucho…',
    'Ahí va a reordenar el mazo.',
    '{name} está pensando con el Canciller. Paciencia.',
    'Cartas que suben, cartas que bajan al fondo.',
  ],
  chancellor_short: [
    'Con tan pocas cartas, el Canciller casi ni cuenta.',
    'El mazo está corto y el Canciller lo nota.',
    'Un Canciller en un mazo flaco: poco que arreglar.',
    'Qué mal momento para un Canciller, con el mazo así.',
    'El Canciller llegó tarde al banquete.',
  ],
  // --- Rey
  king_mine: [
    'Trato hecho: cambio de manos.',
    'Intercambio real, sin devoluciones.',
    'El Rey manda, y yo obedezco.',
    'Veremos quién salió ganando.',
  ],
  king_on_me: [
    'Me cambiaron la mano sin preguntar.',
    '¿Yo? Qué atrevido, {name}.',
    'Con el Rey no se discute.',
    'Mano nueva, aunque no la pedí.',
  ],
  king_other: [
    'Un cambio de manos, cuidado con eso.',
    'Ya se enredó todo.',
    'El Rey ha movido las cartas de sitio.',
    'Trueque de manos en plena mesa.',
  ],
  king_after_priest: [
    'Primero se mira y luego se cambia. Qué casualidad.',
    'Un Sacerdote y luego un Rey: eso huele a plan.',
    'Alguien espió antes de intercambiar, ¿verdad?',
    'Menuda coincidencia entre ese Sacerdote y este Rey.',
    'Se nota que {name} había hecho los deberes.',
  ],
  // --- Condesa
  countess_mine: [
    'La Condesa nunca miente. Casi nunca.',
    'Un poco de elegancia en la mesa.',
    'Condesa fuera. Que cada cual saque conclusiones.',
    'Mi Condesa no da explicaciones.',
  ],
  countess_other: [
    '¿Condesa? Hmm, ¿forzada o farol?',
    'La Condesa es una buena tapadera.',
    '{name} suelta la Condesa con mucha calma.',
    'Condesa en la mesa y yo sin saber por qué.',
  ],
  countess_suspect: [
    'Una Condesa con tanto Rey y Príncipe dando vueltas… sospechoso.',
    '¿Farol de Condesa? Yo no digo nada.',
    'Esa Condesa me suena a coartada, {name}.',
    'Nadie tira una Condesa sin motivo. ¿O sí?',
    'Condesa, Rey, Príncipe… alguien está haciendo teatro.',
  ],
  // --- Mazo
  deck_three: [
    'Quedan tres cartas en el mazo. Esto se pone serio.',
    'Últimas tres cartas: a contar bien.',
    'Con tres cartas en el mazo ya huele a final.',
    'Tres cartas y se acaba la fiesta.',
  ],
  deck_last: [
    'Queda una sola carta en el mazo.',
    'La última carta del mazo. Qué tensión.',
    'Una carta y se acabó. A cuidar la mano.',
    'Última carta del mazo: que sea buena.',
  ],
  deck_empty: [
    'Mazo vacío: esta es la última jugada.',
    'Sin mazo no hay más rondas de robo.',
    'Se acabó el mazo. Ahora cuenta la mano.',
    'El mazo se agotó. A ver quién llega mejor.',
  ],
  // --- Eliminaciones
  eliminated_me: [
    'Me voy a mirar desde las gradas.',
    'Fuera de ronda. Que gane el mejor.',
    'Descanso forzoso.',
    'Me retiro con dignidad. Más o menos.',
    'Hasta aquí llegué en esta ronda.',
  ],
  eliminated_me_princess: [
    'Qué torpeza la mía con la Princesa.',
    'Ay, no, la Princesa…',
    'Una Princesa perdida es una ronda perdida.',
  ],
  eliminated_first: [
    'Primera baja de la ronda: {name}.',
    'Cae {name} el primero. Mala suerte.',
    'Ya hay un eliminado. {name}, descansa.',
    '{name} abre la lista de bajas.',
    'La ronda ya tiene su primera víctima.',
  ],
  eliminated_other: [
    'Uno menos en la mesa.',
    'La mesa queda más tranquila.',
    'Ya cayó otro.',
    '{name} se despide de la ronda.',
  ],
  two_left: [
    'Solo quedamos dos en pie. Duelo final.',
    'Dos jugadores y un destino.',
    'La ronda se decide entre dos. Qué emoción.',
    'Ya no hay público: solo dos en la mesa.',
    'Final de ronda a dos bandas.',
  ],
  // --- Fin de ronda
  round_win_last_mine: [
    '¡Último en pie! Ficha para mí.',
    'Los demás cayeron; yo sigo aquí.',
    'Sobreviví y ahora cobro.',
    'Ronda mía: nadie quedó para discutirlo.',
  ],
  round_win_last_other: [
    '{name} sobrevive a todos. Bien jugado.',
    'Último en pie: {name}. Qué resistencia.',
    'Nadie pudo con {name} esta ronda.',
    'La ronda es de {name}, el superviviente.',
  ],
  round_win_hand_mine: [
    '¡Ronda mía! Ficha para este caballero (o dama).',
    'Mi mano era la más alta. A veces es así de simple.',
    'Gané por carta alta, qué elegante.',
    'Una mano mejor y listo.',
  ],
  round_win_hand_other: [
    'La mano de {name} era la mejor. Enhorabuena.',
    '{name} gana por carta más alta.',
    'Se acabó el mazo y {name} tenía la mejor mano.',
    'Bien llevado, {name}: carta alta para ganar.',
  ],
  round_win_tiebreak_mine: [
    'Empate de manos, pero mis descartes pesaron más.',
    'Gané por descartes. Contabilidad de alto nivel.',
    'Mis descartes sumaban más. Todo estaba calculado (mentira).',
    'Desempate a mi favor, qué sorpresa agradable.',
  ],
  round_win_tiebreak_other: [
    '{name} gana el desempate por descartes.',
    'Mismas manos, pero {name} descartó más valor.',
    'Los descartes de {name} inclinaron la balanza.',
    'Ronda decidida por la suma de descartes. Qué suspense.',
  ],
  round_shared_mine: [
    'Ronda compartida: ficha para todos los empatados.',
    'Empatamos de verdad: manos y descartes iguales.',
    'Nadie gana solo esta vez. Qué fraternal.',
    'Reparto de fichas, cortesía del empate.',
  ],
  round_shared_other: [
    'Empate total: se reparte la ficha.',
    'Ni la mano ni los descartes los separaron.',
    'Varios ganadores esta ronda. Qué generosidad.',
    'Un empate tan perfecto que da hasta gusto.',
  ],
  spy_bonus_mine: [
    '¡El Espía rindió frutos! Ficha extra.',
    'Misión secreta cumplida, gracias.',
    'Un Espía y una ficha. Perfecto.',
    'Mi Espía trabajó en silencio y cobró en voz alta.',
  ],
  spy_bonus_other: [
    '{name} cobra la ficha del Espía. Bien jugado.',
    'El espionaje de {name} dio resultado.',
    'Ficha extra para {name}, el único espía.',
    'Ese Espía de {name} valió oro.',
  ],
  round_lost: [
    'La próxima ronda es mía.',
    'Esta me la guardo para la revancha.',
    'Qué ronda tan reñida.',
    'Perdí esta, pero queda mucha partida.',
  ],
  near_goal_mine: [
    'Estoy a una ficha de ganar. Que nadie me mire.',
    'Una ficha más y lo cierro.',
    'Me falta una. Los nervios empiezan.',
    'A una ficha de la gloria.',
  ],
  near_goal_other: [
    '{name} está a una ficha de ganar. Hay que frenarle.',
    'Cuidado con {name}: le falta solo una ficha.',
    'Si {name} gana una más, se acabó.',
    'Todos contra {name}, que está a una ficha del final.',
    '{name} huele la victoria.',
  ],
  token_tie: [
    'Las fichas van empatadas. Esto está muy parejo.',
    'Empate en cabeza: nadie se despega.',
    'Dos jugadores con las mismas fichas. Qué emoción.',
    'La carrera está igualadísima.',
  ],
  // --- Elegido como objetivo
  targeted: [
    '¿Yo? Qué atrevido.',
    '¿A mí me eliges, {name}? Qué valor.',
    'Siempre me toca a mí.',
    'Vaya, parece que tengo admiradores.',
    'No me mires así, {name}.',
  ],
  // --- Despedidas
  farewell_win: [
    '¡El corazón de la princesa es mío!',
    'Gracias, gracias, no se levanten.',
    'Una victoria muy afectuosa.',
    'Qué gran partida. Y qué gran ganador.',
    'La carta de amor llegó a su destino.',
    'Esto sí que fue una declaración en toda regla.',
  ],
  farewell_lose: [
    'Felicidades, fue una buena partida.',
    'La carta de amor se me perdió por el camino.',
    'Revancha cuando quieran.',
    'Ganaste justo. Esta vez.',
    'Perdí, pero me divertí. Casi.',
    'Para la próxima traigo mejores cartas.',
  ],
  farewell_long_win: [
    'Qué partida tan larga y qué final tan dulce.',
    'Tantas rondas y al final, ¡mía!',
    'Resistí todas las rondas. Merecido.',
    'Larga, larguísima, pero ganada.',
  ],
  farewell_long_lose: [
    'Qué partida tan larga. Merece un descanso.',
    'Tantas rondas y no fue suficiente.',
    'Fue una maratón. Felicidades a quien llegó primero.',
    'Después de tantas rondas, hasta perder da gusto.',
  ],
  farewell_shared: [
    'Ganamos a medias: un empate de lujo.',
    'Compartir la victoria sabe mejor.',
    'Dos coronas en una mesa. Qué justicia.',
    'Nadie gana solo hoy. Me gusta.',
  ],
} as const satisfies Record<string, readonly string[]>;

export type Situation = keyof typeof LINES;

export const SITUATIONS = Object.keys(LINES) as Situation[];

/** Total number of lines bots can say. */
export function phraseCount(): number {
  return SITUATIONS.reduce((n, s) => n + LINES[s].length, 0);
}
