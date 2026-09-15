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
     Mischung: fällige Wiederholungen, neue Wörter, Sätze, Phrasen. */
  build(DB) {
    const lvl = this.level(DB);
    const rank = LVL_RANK[lvl];
    const W = Store.data.words;
    const items = [];

    // 1 · Fällige Wiederholungen
    const due = DB.vocab
      .filter(v => Leitner.seen(W, v.id) && Leitner.isDue(W[v.id]))
      .sort((a, b) => (W[a.id].box - W[b.id].box));
    sample(due, 10).forEach(v => {
      items.push({ kind: exerciseFor(W[v.id]), word: v });
    });

    // 2 · Neue Wörter des aktuellen Niveaus
    const fresh = DB.vocab.filter(v =>
      !Leitner.seen(W, v.id) && LVL_RANK[v.level] <= rank);
    const ahead = DB.vocab.filter(v =>
      !Leitner.seen(W, v.id) && LVL_RANK[v.level] === rank + 1);
    const newOnes = fresh.slice(0, 6).concat(sample(ahead, 1));
    newOnes.forEach(v => items.push({ kind: 'intro', word: v }));

    // 3 · Sätze — nur eigenes Niveau, nur passende Länge, nur wenn Grundstock da
    if (this.sentencesReady()) {
      const cap = this.maxTokens(lvl);
      const open = DB.sentences.filter(s =>
        LVL_RANK[s.reqLevel] <= rank &&
        s.tokens <= cap &&
        this.unlocked(s));
      sample(open, 4).forEach(s => {
        items.push({ kind: Math.random() < 0.35 ? 'dictation' : 'build', sent: s });
      });
    }

    // 4 · Phrasen — nachsprechen nur, wenn die Erkennung wirklich da ist
    //     und der Nutzer sie nicht abgeschaltet hat
    const ph = DB.phrases.filter(p => LVL_RANK[p.level] <= rank);
    const speakable = Session.speechOn();
    sample(ph, 3).forEach(p => {
      items.push({ kind: speakable ? 'speak' : 'phrase', phrase: p });
    });

    // Neue Wörter zuerst, danach gemischt
    const intro = items.filter(i => i.kind === 'intro');
    const rest = shuffle(items.filter(i => i.kind !== 'intro'));
    const out = [];
    intro.forEach((it, i) => {
      out.push(it);
      out.push(...rest.splice(0, i === 0 ? 1 : 2));
    });
    out.push(...rest);
    return out.slice(0, Store.data.settings.goal);
  },
};

/* Welche Übungsform ist dran?
   Je sicherer ein Wort sitzt, desto mehr wird verlangt:
   Kasten 1–2 erkennen, ab Kasten 3 selbst schreiben. */
function exerciseFor(st) {
  const box = (st && st.box) || 1;
  if (box <= 2) return 'choice';
  if (box === 3) return 'type';
  return Math.random() < 0.65 ? 'type' : 'choice';
}

/* ---------- Aufgaben erzeugen ---------- */
const Make = {
  // Mehrfachauswahl über eine Vokabel
  choice(v, DB) {
    const dir = Math.random() < 0.5 ? 'de2sk' : 'sk2de';
    const same = DB.vocab.filter(x => x.pos === v.pos && x.id !== v.id);
    const pool = same.length >= 3 ? same : DB.vocab.filter(x => x.id !== v.id);
    const wrong = sample(pool, 3);
    const key = dir === 'de2sk' ? 'sk' : 'de';
    return {
      dir,
      ask: dir === 'de2sk' ? v.de : v.sk,
      answer: v[key],
      options: shuffle(wrong.map(x => x[key]).concat([v[key]])),
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
