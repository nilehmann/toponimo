/** Todos los textos que ve quien juega, en un solo lugar para poder cambiarlos sin recorrer los
 *  componentes. Los que se completan en tiempo de ejecución son funciones: así `tsc` avisa si
 *  cambian los parámetros, y los plurales y las variantes quedan escritos como código común.
 *
 *  Quedan afuera el `<title>` de `index.html`, que se lee antes de que cargue el bundle, y el
 *  banco de `#banco`, que solo existe en desarrollo. */
export const COPY = {
  app: {
    title: "Topónimo",
    loading: "Cargando localidades…",
    loadFailed: "No se pudieron cargar las localidades.",
    retry: "Reintentar",
    openFailed: "No se pudo armar la caravana.",
    backHome: "Volver al inicio",
    leave: "Salir",
    credits:
      "Localidades, aldeas y pueblos reales tomados de la cartografía del Censo 2017 (INE). Los " +
      "nombres inventados se generaron a partir de esos mismos nombres y se verificó que no " +
      "aparezcan en ese registro.",
    /** Mientras el host no dice quién es esta persona. */
    askingWhoAmI: "Preguntándole al guía quién eres…",
  },

  theme: {
    system: "Sistema",
    light: "Claro",
    dark: "Oscuro",
    menu: "Tema",
    button: (current: string) => `Tema: ${current}. Cambiar tema.`,
    tooltip: (current: string) => `Tema: ${current}`,
  },

  /** Lo que se ve mientras se abre la sesión. */
  opening: {
    solo: "Sorteando letreros…",
    create: "Buscando un broker…",
    join: "Uniéndote a la caravana…",
    reopenRoom: "Volviendo a la caravana…",
    resumeSolo: "Retomando la partida…",
  },

  home: {
    pitch:
      "Toma la ruta por Chile y fíjate bien en los letreros que van apareciendo en la carretera. " +
      "Algunos señalan pueblos de verdad y otros son puro chamullo. ¿Puedes diferenciarlos?",
    savedRoom: (code: string) => `la caravana ${code}`,
    savedSolo: "tu partida",
    resume: (what: string) => `Retomar ${what}`,
    resumeAt: (what: string, round: number) => `Retomar ${what} en la ronda ${round}`,
    backToSummary: (what: string) => `Volver al resumen de ${what}`,
    forgetRoom: "Dejar la caravana",
    forgetSolo: "Olvidar la partida",
    backToRoom: (code: string) => `Volver a la caravana ${code}`,
    playSolo: "Viajar solo",
    createRoom: "Armar una caravana",
    joinWithCode: "Unirse a una caravana",
    createTitle: "Armar una caravana",
    joinTitle: "Unirse a una caravana",
    codeLabel: "Código de la caravana",
    codePlaceholder: "7 caracteres",
    nameLabel: "Tu nombre",
    namePlaceholder: "Como te dicen",
    createSubmit: "Armar la caravana",
    joinSubmit: "Unirse",
    back: "Volver",
    /** El nombre de quien juega solo sin haber escrito uno nunca. */
    soloName: "Vos",
  },

  lobby: {
    hostIntro:
      "Cuando estén todos, parten. Tú guías la caravana y decides cuándo se revela cada letrero.",
    guestIntro: "Ya estás en la caravana. Parten cuando el guía lo diga.",
    invite: "Pásales el código, el link o el QR",
    copyLink: "Copiar link",
    linkCopied: "Link copiado",
    qrLabel: "Código QR para unirse a la caravana",
    qrFailed: "No se pudo dibujar el QR. Pásales el código o el link.",
    count: (n: number) => (n === 1 ? "Estás solo" : `${n} personas en la caravana`),
    start: "Empezar la ruta",
    waitingStart: "Esperando a que el guía dé la partida.",
  },

  round: {
    progress: "Progreso",
    tick: (n: number) => `Ronda ${n}`,
    counter: (n: number, total: number) => `Ronda ${n} de ${total}`,
    score: (n: number) => `${n} ${n === 1 ? "acierto" : "aciertos"}`,
    real: "Existe",
    fake: "Chamullo",
    keyboard: "Teclado:",
    keyReal: "existe",
    keyFake: "chamullo",
    missing: (n: number) =>
      n === 0
        ? "Respondieron todos."
        : n === 1
          ? "Falta uno por responder."
          : `Faltan ${n} por responder.`,
    room: "La caravana",
    whoFell: "Quién cayó",
    reveal: "Revelar el letrero",
    upToDate: (n: number, total: number) => `${n} de ${total} al día`,
    next: "Siguiente",
    seeResult: "Ver resultado",
    waitingHost: "Esperando al guía.",
    waitingResult: "Esperando el resultado.",
  },

  players: {
    me: "tú",
    host: "guía",
    thinking: "Pensando",
    answered: "Respondió",
    right: "Acertó",
    wrong: "Cayó",
    noAnswer: "No respondió",
    behind: "atrasado",
  },

  reveal: {
    /** Sin respuesta: no hay acierto ni error que anunciar. */
    isReal: "Existe.",
    isFake: "Es chamullo.",
    rightReal: "Correcto, existe.",
    rightFake: "Correcto, es chamullo.",
    wrongReal: "Incorrecto, existe.",
    wrongFake: "Incorrecto, es chamullo.",
    /** La franja cruzada sobre el letrero. */
    fakeBand: "Chamullo",
    where: (comuna: string, region: string) => `Comuna de ${comuna}, ${region}.`,
    notInCensus: "Este nombre no figura entre las localidades del Censo 2017.",
    map: (name: string) => `Mapa de ${name}`,
    mapFailed: "No se pudo cargar el mapa.",
    population: "Habitantes",
    reference: "Referencia",
    km: (km: number) => `${km} km`,
    from: (place: string) => `de ${place}`,
  },

  summary: {
    mine: "Tu resultado",
    board: "El marcador",
    score: (n: number, total: number) => `${n} de ${total}`,
    /** La primera cuyo mínimo alcance el puntaje, en orden. */
    notes: [
      [15, "Ruta completa sin un error."],
      [12, "Conoces bien los caminos rurales."],
      [9, "Más acierto que azar."],
      [0, "Caíste seguido en el chamullo."],
    ] as [min: number, note: string][],
    realIn: (comuna: string) => `Existe, en ${comuna}`,
    fake: "Chamullo",
    right: "Acertaste",
    wrong: "Fallaste",
    noAnswer: "Sin responder",
    again: "Jugar otra ruta",
    waitingAgain: "Esperando a que el guía elija otra ruta.",
  },

  connection: {
    unreachable: "No logramos comunicarnos con el guía. Revisa la señal y vuelve a intentar.",
    late: "Tu respuesta llegó después de que el guía revelara, así que esta ronda no te cuenta.",
    hint: "Lo que ves es lo último que dijo el guía. Si algo no cuadra, refresca.",
    refresh: "Refrescar",
  },

  /** Llegan a la pantalla tal cual, como `message` del error. */
  errors: {
    http: (status: number) => `El servidor respondió ${status}.`,
    noRoom: "No hay ninguna caravana con ese código.",
    brokerSilent: (url: string) => `${url} no contestó`,
    noBroker: (failures: string[]) => `Ningún broker contestó. ${failures.join("; ")}`,
  },
} as const;
