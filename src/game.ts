type Form = "a" | "b" | "c";
type RealRow = [name: string, comuna: number, region: number];
interface GameData {
  R: Record<Form, RealRow[]>;
  F: Record<Form, string[]>;
  regions: string[];
  comunas: string[];
}
interface Round {
  name: string;
  real: boolean;
  comuna?: string;
  region?: string;
  guess?: boolean;
}

declare const DATA: GameData;

const ROUNDS = 15;
const FORMS: Form[] = ["a", "b", "c"];

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const els = {
  sign: $<HTMLDivElement>("sign"),
  signName: $<HTMLParagraphElement>("sign-name"),
  signSub: $<HTMLParagraphElement>("sign-sub"),
  tape: $<HTMLDivElement>("tape"),
  plate: $<HTMLDivElement>("plate"),
  counter: $<HTMLSpanElement>("counter"),
  score: $<HTMLSpanElement>("score"),
  ticks: $<HTMLOListElement>("ticks"),
  choices: $<HTMLDivElement>("choices"),
  btnReal: $<HTMLButtonElement>("btn-real"),
  btnFake: $<HTMLButtonElement>("btn-fake"),
  verdict: $<HTMLParagraphElement>("verdict"),
  detail: $<HTMLParagraphElement>("detail"),
  reveal: $<HTMLDivElement>("reveal"),
  btnNext: $<HTMLButtonElement>("btn-next"),
  play: $<HTMLElement>("play"),
  summary: $<HTMLElement>("summary"),
  summaryList: $<HTMLOListElement>("summary-list"),
  summaryNote: $<HTMLParagraphElement>("summary-note"),
  btnAgain: $<HTMLButtonElement>("btn-again"),
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Elige la estructura del nombre con la misma proporción que tienen las localidades reales,
 *  para que la forma del nombre no delate si es real o inventado. */
function pickForm(): Form {
  const weights = FORMS.map((f) => DATA.R[f].length);
  let r = Math.random() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < FORMS.length; i++) {
    r -= weights[i];
    if (r < 0) return FORMS[i];
  }
  return "a";
}

function buildRounds(): Round[] {
  const nReal = Math.random() < 0.5 ? 7 : 8;
  const flags = shuffle(Array.from({ length: ROUNDS }, (_, i) => i < nReal));
  const used = new Set<string>();
  const rounds: Round[] = [];
  for (const real of flags) {
    let round: Round | null = null;
    while (!round || used.has(round.name)) {
      const f = pickForm();
      if (real) {
        const [name, c, r] = pick(DATA.R[f]);
        round = { name, real, comuna: DATA.comunas[c], region: DATA.regions[r] };
      } else {
        round = { name: pick(DATA.F[f]), real };
      }
    }
    used.add(round.name);
    rounds.push(round);
  }
  return rounds;
}

let rounds: Round[] = [];
let current = 0;
let score = 0;
let answered = false;

function renderTicks(): void {
  els.ticks.innerHTML = "";
  rounds.forEach((r, i) => {
    const li = document.createElement("li");
    if (r.guess !== undefined) li.dataset.state = r.guess === r.real ? "ok" : "miss";
    else if (i === current) li.dataset.state = "now";
    li.setAttribute("aria-label", `Ronda ${i + 1}`);
    els.ticks.appendChild(li);
  });
}

function showRound(): void {
  const r = rounds[current];
  answered = false;
  els.signName.textContent = r.name;
  els.signSub.textContent = "";
  els.sign.classList.remove("is-fake", "is-real");
  els.tape.hidden = true;
  els.plate.hidden = true;
  els.reveal.hidden = true;
  els.choices.hidden = false;
  els.btnReal.disabled = false;
  els.btnFake.disabled = false;
  els.counter.textContent = `Ronda ${current + 1} de ${ROUNDS}`;
  els.score.textContent = `${score} ${score === 1 ? "acierto" : "aciertos"}`;
  renderTicks();
}

function answer(guessReal: boolean): void {
  if (answered) return;
  answered = true;
  const r = rounds[current];
  r.guess = guessReal;
  const correct = guessReal === r.real;
  if (correct) score++;

  els.btnReal.disabled = true;
  els.btnFake.disabled = true;
  els.choices.hidden = true;

  if (r.real) {
    els.sign.classList.add("is-real");
    els.plate.hidden = false;
    els.plate.textContent = r.comuna ?? "";
    els.verdict.textContent = correct ? "Correcto, existe." : "Existe.";
    els.detail.textContent = `Comuna de ${r.comuna}, ${r.region}.`;
  } else {
    els.sign.classList.add("is-fake");
    els.tape.hidden = false;
    els.verdict.textContent = correct ? "Correcto, es inventado." : "Es inventado.";
    els.detail.textContent = "Este nombre no figura entre las localidades del Censo 2017.";
  }
  els.verdict.dataset.state = correct ? "ok" : "miss";
  els.score.textContent = `${score} ${score === 1 ? "acierto" : "aciertos"}`;
  els.btnNext.textContent = current + 1 < ROUNDS ? "Siguiente letrero" : "Ver resultado";
  els.reveal.hidden = false;
  renderTicks();
  els.btnNext.focus({ preventScroll: true });
}

function next(): void {
  if (!answered) return;
  current++;
  if (current < ROUNDS) showRound();
  else showSummary();
}

function showSummary(): void {
  els.play.hidden = true;
  els.summary.hidden = false;
  $<HTMLParagraphElement>("summary-score").textContent = `${score} de ${ROUNDS}`;
  const notes: [number, string][] = [
    [15, "Ruta completa sin un error."],
    [12, "Conoces bien los caminos rurales."],
    [9, "Más acierto que azar."],
    [0, "Los nombres inventados te engañaron seguido."],
  ];
  els.summaryNote.textContent = notes.find(([min]) => score >= min)?.[1] ?? "";
  els.summaryList.innerHTML = "";
  for (const r of rounds) {
    const li = document.createElement("li");
    li.dataset.state = r.guess === r.real ? "ok" : "miss";
    const name = document.createElement("span");
    name.className = "s-name";
    name.textContent = r.name;
    const info = document.createElement("span");
    info.className = "s-info";
    info.textContent = r.real ? `Existe, en ${r.comuna}` : "Inventado";
    const mark = document.createElement("span");
    mark.className = "s-mark";
    mark.textContent = r.guess === r.real ? "Acertaste" : "Fallaste";
    li.append(name, info, mark);
    els.summaryList.appendChild(li);
  }
  els.btnAgain.focus({ preventScroll: true });
}

function start(): void {
  rounds = buildRounds();
  current = 0;
  score = 0;
  els.summary.hidden = true;
  els.play.hidden = false;
  showRound();
}

els.btnReal.addEventListener("click", () => answer(true));
els.btnFake.addEventListener("click", () => answer(false));
els.btnNext.addEventListener("click", next);
els.btnAgain.addEventListener("click", start);

document.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (!els.play.hidden && !answered) {
    if (k === "e") answer(true);
    else if (k === "i") answer(false);
  }
});

start();
