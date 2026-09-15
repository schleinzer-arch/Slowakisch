/* ============================================================
   Slovenčina — Kern
   Datenhaltung, Leitner-Kästen, Sessionaufbau, Übungserzeugung
   ============================================================ */
'use strict';

/* ---------- Speicher ---------- */
const KEY = 'sk2';

const Store = {
  data: null,

  blank() {
    return {
      v: 2,
      words: {},        // id -> {box, due, strength, learned}
      phrases: {},      // id -> {box, due, strength}
      days: {},         // 'YYYY-MM-DD' -> {seen, right, newWords, sessions}
      settings: { goal: 24, speech: true },
      started: Store.today(),
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      this.data = raw ? JSON.parse(raw) : this.blank();
    } catch (e) {
      this.data = this.blank();
    }
    if (!this.data.words) this.data = this.blank();
    if (!this.data.settings) this.data.settings = { goal: 24, speech: true };
    if (this.data.settings.speech === undefined) this.data.settings.speech = true;
    return this.data;
  },

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); }
    catch (e) { /* Speicher voll oder gesperrt — Sitzung läuft weiter */ }
  },

  today() {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  },

  dayKey(offset) {
    const d = new Date();
    d.setDate(d.getDate() + (offset || 0));
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  },

  day(key) {
    const k = key || this.today();
    if (!this.data.days[k]) this.data.days[k] = { seen: 0, right: 0, newWords: 0, sessions: 0 };
    if (this.data.days[k].sessions === undefined) this.data.days[k].sessions = 0;
    return this.data.days[k];
  },

  reset() {
    this.data = this.blank();
    this.save();
  },
};

/* ---------- Leitner ---------- */
// Kasten 1..5, Intervalle in Tagen
const INTERVALS = [0, 1, 3, 7, 14, 35];
const MASTER_BOX = 4;   // ab hier gilt ein Wort als im Langzeitgedächtnis

const Leitner = {
  state(map, id) {
    if (!map[id]) map[id] = { box: 1, due: null, strength: 0, learned: null };
    return map[id];
  },

  isDue(st) {
    if (!st || st.due === null) return true;
    return st.due <= Store.today();
  },

  // seen=false → Wort war noch nie dran
  seen(map, id) { return !!map[id]; },

  promote(map, id) {
    const st = this.state(map, id);
    const before = st.box;
    st.box = Math.min(5, st.box + 1);
    st.due = Store.dayKey(INTERVALS[st.box]);
    if (before < MASTER_BOX && st.box >= MASTER_BOX && !st.learned) {
      st.learned = Store.today();
      Store.day().newWords++;
    }
    return st;
  },

  demote(map, id) {
    const st = this.state(map, id);
    st.box = 1;
    st.due = Store.dayKey(1);
    st.learned = null;
    return st;
  },

  // Übungsstufe: 0 neu · 1 erkennen · 2 zusammensetzen · 3 tippen · 4 sprechen
  raise(map, id, level) {
    const st = this.state(map, id);
    if (level > st.strength) st.strength = level;
  },
};

/* ---------- Textvergleich ---------- */
const Text = {
  norm(s) {
    return (s || '')
      .toLowerCase()
      .replace(/[.,!?;:„"“”'`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  // ohne Diakritika — für die Zwischenstufe „fast richtig"
  flat(s) {
    return this.norm(s)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/ľ/g, 'l').replace(/ď/g, 'd')
      .replace(/ť/g, 't').replace(/ň/g, 'n');
  },

  // 'exact' | 'diacritics' | 'close' | 'wrong'
  compare(said, target) {
    const a = this.norm(said), b = this.norm(target);
    if (!a) return 'wrong';
    if (a === b) return 'exact';
    if (this.flat(a) === this.flat(b)) return 'diacritics';
    const aw = a.split(' '), bw = b.split(' ');
    let hit = 0;
    const pool = bw.slice();
    aw.forEach(w => {
      const i = pool.findIndex(x => this.flat(x) === this.flat(w));
      if (i >= 0) { hit++; pool.splice(i, 1); }
    });
    return (hit / Math.max(bw.length, 1)) >= 0.7 ? 'close' : 'wrong';
  },

  // Welche Zeichen mit Diakritikum wurden verschluckt?
  missedMarks(said, target) {
    const marks = [];
    const t = this.norm(target), s = this.norm(said);
    if (this.flat(t) !== this.flat(s)) return marks;
    for (let i = 0; i < t.length && i < s.length; i++) {
      if (t[i] !== s[i] && this.flat(t[i]) === this.flat(s[i])) {
        if (!marks.includes(t[i])) marks.push(t[i]);
      }
    }
    return marks;
  },
};

/* ---------- Ausspracheerklärungen ---------- */
const SOUNDS = {
  'ď': 'weiches d, etwa wie „dj“',
  'ť': 'weiches t, etwa wie „tj“',
  'ň': 'weiches n, wie in „Cognac“',
  'ľ': 'weiches l, Zunge am Gaumen',
  'š': 'wie „sch“',
  'č': 'wie „tsch“',
  'ž': 'wie das „g“ in „Garage“',
  'á': 'langes a',
  'é': 'langes e',
  'í': 'langes i',
  'ó': 'langes o',
  'ú': 'langes u',
  'ý': 'langes i',
  'ô': 'wie „uo“',
  'ä': 'offenes ä',
  'ĺ': 'langes l',
  'ŕ': 'langes r',
};

/* ---------- Sprachausgabe ---------- */
const Voice = {
  ready: false,
  pick: null,

  init() {
    if (!window.speechSynthesis) return;
    const load = () => {
      const vs = window.speechSynthesis.getVoices();
      if (!vs.length) return;
      this.pick = vs.find(v => v.lang.toLowerCase().startsWith('sk'))
        || vs.find(v => v.lang.toLowerCase().startsWith('cs'))
        || null;
      this.ready = true;
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    setTimeout(load, 700);
  },

  say(text, rate) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (this.pick) u.voice = this.pick;
    u.lang = 'sk-SK';
    u.rate = rate || 0.88;
    window.speechSynthesis.speak(u);
  },
};

/* ---------- Spracherkennung ---------- */
const Listen = {
  SR: window.SpeechRecognition || window.webkitSpeechRecognition || null,
  rec: null,
  active: false,

  get available() { return !!this.SR; },

  start(onPartial, onDone, onError) {
    if (!this.SR || this.active) return;
    let rec;
    try { rec = new this.SR(); }
    catch (e) { onError && onError('start-failed'); return; }

    this.rec = rec;
    this.active = true;
    let last = '';

    rec.lang = 'sk-SK';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onresult = ev => {
      const r = ev.results[ev.results.length - 1];
      last = r[0].transcript;
      onPartial && onPartial(last, r.isFinal);
    };
    rec.onerror = ev => {
      this.active = false;
      onError && onError(ev.error || 'unknown');
    };
    rec.onend = () => {
      this.active = false;
      this.rec = null;
      onDone && onDone(last);
    };

    try { rec.start(); }
    catch (e) { this.active = false; onError && onError('start-failed'); }
  },

  stop() {
    if (this.rec) { try { this.rec.stop(); } catch (e) { /* schon beendet */ } }
  },
};

/* ---------- Hilfsfunktionen ---------- */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sample(arr, n) { return shuffle(arr).slice(0, n); }

const LVL_RANK = { A1: 1, A2: 2, B1: 3 };

/* ---------- Ablenker ----------
   Falsche Antwortmöglichkeiten kommen nur aus Wörtern, die schon
   begonnen wurden. Sonst liesse sich jede Frage durch Ausschliessen
   lösen: was man noch nie gesehen hat, ist selten die richtige Antwort. */
function distractorPool(DB, v) {
  const W = Store.data.words;
  let pool = DB.vocab.filter(x => x.id !== v.id && W[x.id] && x.pos === v.pos);
  if (pool.length < 3) pool = DB.vocab.filter(x => x.id !== v.id && W[x.id]);
  if (pool.length < 3) {
    // Am Anfang sind noch zu wenige Wörter begonnen: die nächsten der Liste
    const near = DB.vocab.filter(x => x.id !== v.id && x.level === v.level);
    const i = Math.max(0, near.findIndex(x => x.ord >= v.ord) - 6);
    pool = pool.concat(near.slice(i, i + 14));
  }
  return pool;
}

/* ---------- Sessionaufbau ---------- */
const Session = {
  // Sprechübungen nur, wenn der Browser sie unterstützt UND sie eingeschaltet sind
  speechOn() {
    return Listen.available && Store.data.settings.speech !== false;
  },

  // Aktuelles Niveau aus dem Langzeitwortschatz ableiten
  level(DB) {
    const n = this.masteredCount(DB);
    if (n < 300) return 'A1';
    if (n < 800) return 'A2';
    return 'B1';
  },

  masteredCount(DB) {
    let n = 0;
    for (const id in Store.data.words) {
      if (Store.data.words[id].box >= MASTER_BOX) n++;
    }
    return n;
  },

  // Wie viele Wörter eines Satzes sind bekannt?
  coverage(sent) {
    if (!sent.words.length) return 1;
    let known = 0;
    sent.words.forEach(w => {
      const st = Store.data.words[w];
      if (st && st.box >= 2) known++;
    });
    return known / sent.words.length;
  },

  // Ein Satz ist frei, wenn genug seiner Wörter sitzen.
  // Die Nachsicht "ein unbekanntes Wort ist erlaubt" gilt erst ab drei
  // verknüpften Wörtern — sonst wäre ein Satz mit einer einzigen
  // Verknüpfung von Anfang an offen, ohne dass man ihn lösen könnte.
  unlocked(sent) {
    const n = sent.words.length;
    if (n < 2) return false;
    let unknown = 0;
    sent.words.forEach(w => {
      const st = Store.data.words[w];
      if (!st || st.box < 2) unknown++;
    });
    if (n >= 3 && unknown <= 1) return true;
    return this.coverage(sent) >= 0.8;
  },

  // Wie lang darf ein Satz auf dieser Stufe sein?
  maxTokens(level) {
    return level === 'A1' ? 6 : level === 'A2' ? 10 : 99;
  },

  // Satzübungen erst, wenn überhaupt ein Grundstock sitzt
  sentencesReady() {
    let n = 0;
    for (const id in Store.data.words) if (Store.data.words[id].box >= 2) n++;
    return n >= 30;
  },

  /* Baut die Übungsliste für heute.
     Ein neues Wort wird nicht nur gezeigt, sondern noch in derselben
     Session zweimal geübt — sonst begegnet man ihm erst am Folgetag
     wieder und hat es bis dahin verloren. */
  build(DB) {
    const lvl = this.level(DB);
    const rank = LVL_RANK[lvl];
    const W = Store.data.words;
    const goal = Store.data.settings.goal;
    const core = [];      // Wiederholungen, Sätze, Phrasen
    const fresh = [];     // je neues Wort: Einführung + zwei Übungen

    // 1 · Fällige Wiederholungen
    const due = DB.vocab.filter(v => Leitner.seen(W, v.id) && Leitner.isDue(W[v.id]));
    sample(due, 9).forEach(v => core.push({ kind: exerciseFor(W[v.id]), word: v }));

    // 2 · Neue Wörter — streng der Reihe nach, kein Vorgriff auf die nächste Stufe
    const next = DB.vocab.filter(v => !Leitner.seen(W, v.id) && LVL_RANK[v.level] <= rank);
    const newOnes = next.slice(0, 5);
    newOnes.forEach(v => {
      fresh.push([
        { kind: 'intro',  word: v },
        { kind: 'choice', word: v, dir: 'sk2de', fresh: true },
        { kind: 'choice', word: v, dir: 'de2sk', fresh: true },
      ]);
    });

    // 3 · Paare zuordnen aus den neuen Wörtern
    if (newOnes.length >= 4) core.push({ kind: 'match', words: newOnes.slice() });

    // 4 · Sätze — gedeckelt auf ein Sechstel der Session
    if (this.sentencesReady()) {
      const cap = this.maxTokens(lvl);
      const max = Math.max(1, Math.floor(goal / 6));
      const open = DB.sentences.filter(s =>
        LVL_RANK[s.reqLevel] <= rank && s.tokens <= cap && this.unlocked(s));
      sample(open, max).forEach(s => {
        core.push({ kind: Math.random() < 0.35 ? 'dictation' : 'build', sent: s });
      });
    }

    // 5 · Phrasen — der Reihe nach, nicht zufällig
    const P = Store.data.phrases;
    const speak = this.speechOn();
    const ready = DB.phrases.filter(p => LVL_RANK[p.level] <= rank);
    const pDue = ready.filter(p => !P[p.id] || Leitner.isDue(P[p.id]));
    pDue.slice(0, speak ? 3 : 2).forEach(p => {
      core.push({ kind: speak ? 'speak' : 'phrasechoice', phrase: p });
    });

    return this.weave(core, fresh, goal);
  },

  /* Mischt so, dass auf jede Einführung bald die zugehörige Übung folgt:
     Einführung, dann zwei bis drei andere Aufgaben, dann die erste Übung
     dazu, später die zweite. */
  weave(core, fresh, goal) {
    const rest = shuffle(core);
    const out = [];
    const later = [];
    fresh.forEach(trio => {
      out.push(trio[0]);                  // Einführung
      out.push(...rest.splice(0, 2));     // Abstand
      out.push(trio[1]);                  // erste Übung, gleiche Session
      later.push(trio[2]);                // zweite Übung kommt später
    });
    out.push(...rest);
    // Die zweiten Übungen gleichmässig über die zweite Hälfte verteilen
    const start = Math.max(out.length - later.length * 2, Math.floor(out.length / 2));
    later.forEach((it, i) => {
      const at = Math.min(out.length, start + i * 2 + 1);
      out.splice(at, 0, it);
    });
    return out.slice(0, goal);
  },
};


/* Welche Übungsform ist dran?
   Je sicherer ein Wort sitzt, desto mehr wird verlangt:
   Kasten 1 erkennen, ab Kasten 2 auch selbst schreiben. */
function exerciseFor(st) {
  const box = (st && st.box) || 1;
  if (box <= 1) return 'choice';
  if (box === 2) return Math.random() < 0.5 ? 'type' : 'choice';
  return Math.random() < 0.7 ? 'type' : 'choice';
}

/* ---------- Aufgaben erzeugen ---------- */
const Make = {
  // Mehrfachauswahl über eine Vokabel
  choice(v, DB, forceDir) {
    const dir = forceDir || (Math.random() < 0.5 ? 'de2sk' : 'sk2de');
    const wrong = sample(distractorPool(DB, v), 3);
    const key = dir === 'de2sk' ? 'sk' : 'de';
    return {
      dir,
      ask: dir === 'de2sk' ? v.de : v.sk,
      answer: v[key],
      options: shuffle(wrong.map(x => x[key]).concat([v[key]])),
    };
  },

  // Paare zuordnen: fünf deutsche und fünf slowakische Wörter
  pairs(words) {
    const pick = sample(words, Math.min(5, words.length));
    return {
      left:  shuffle(pick.map(v => ({ id: v.id, text: v.de }))),
      right: shuffle(pick.map(v => ({ id: v.id, text: v.sk }))),
      total: pick.length,
    };
  },

  // Wortbausteine aus einem Satz.
  // Ablenker kommen aus denselben Wortarten wie der Satz — sonst
  // liesse sich die Aufgabe durch blosses Ausschliessen loesen.
  build(s, DB) {
    const target = s.sk.replace(/\s+/g, ' ').trim();
    const parts = target.split(' ');
    const low = target.toLowerCase();
    const kinds = s.words.map(id => DB.byId[id] && DB.byId[id].pos).filter(Boolean);
    let pool = DB.vocab.filter(v =>
      kinds.indexOf(v.pos) !== -1 && low.indexOf(v.sk.toLowerCase()) === -1);
    if (pool.length < 4) {
      pool = DB.vocab.filter(v => low.indexOf(v.sk.toLowerCase()) === -1);
    }
    const want = Math.min(3, Math.max(2, 6 - parts.length));
    const extras = sample(pool, want).map(v => v.sk);
    return { target, parts, bank: shuffle(parts.concat(extras)) };
  },
};

/* ---------- Statistik ---------- */
const Stats = {
  // Eine Serie zaehlt Tage mit mindestens einer abgeschlossenen Session.
  // Der laufende Tag unterbricht die Serie nicht, solange er noch offen ist.
  streak() {
    let n = 0;
    for (let i = 0; i < 400; i++) {
      const d = Store.data.days[Store.dayKey(-i)];
      const done = d && d.sessions > 0;
      if (done) { n++; continue; }
      if (i === 0) continue;
      break;
    }
    return n;
  },

  mastered() {
    let n = 0;
    for (const id in Store.data.words) if (Store.data.words[id].box >= MASTER_BOX) n++;
    return n;
  },

  touched() { return Object.keys(Store.data.words).length; },

  learnedToday() {
    const d = Store.data.days[Store.today()];
    return d ? d.newWords : 0;
  },

  accuracy() {
    let seen = 0, right = 0;
    for (const k in Store.data.days) {
      seen += Store.data.days[k].seen;
      right += Store.data.days[k].right;
    }
    return seen ? Math.round(right / seen * 100) : 0;
  },

  byBox() {
    const b = [0, 0, 0, 0, 0, 0];
    for (const id in Store.data.words) b[Store.data.words[id].box]++;
    return b;
  },

  cefr() {
    const m = this.mastered();
    if (m >= 800) return { label: 'B1 in Arbeit', next: 1200, at: m };
    if (m >= 300) return { label: 'A2 in Arbeit', next: 800, at: m };
    return { label: 'A1 in Arbeit', next: 300, at: m };
  },
};
