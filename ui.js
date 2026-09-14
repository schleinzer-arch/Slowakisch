/* ============================================================
   Slovenčina — Oberfläche
   ============================================================ */
'use strict';

const DB = { vocab: [], sentences: [], phrases: [], grammar: [], byId: {}, sentById: {} };

const App = {
  screen: 'home',
  session: null,
  el: null,

  async boot() {
    this.el = document.getElementById('app');
    Store.load();
    Voice.init();
    try {
      const [v, s, p, g] = await Promise.all([
        fetch('data/vocab.json').then(r => r.json()),
        fetch('data/sentences.json').then(r => r.json()),
        fetch('data/phrases.json').then(r => r.json()),
        fetch('data/grammar.json').then(r => r.json()),
      ]);
      DB.vocab = v; DB.sentences = s; DB.phrases = p; DB.grammar = g;
      v.forEach(x => DB.byId[x.id] = x);
      s.forEach(x => DB.sentById[x.id] = x);
    } catch (e) {
      this.el.innerHTML =
        '<div style="padding:40px 24px;text-align:center;">' +
        '<div class="title" style="margin-bottom:8px;">Daten nicht geladen</div>' +
        '<div class="small">Die Dateien im Ordner <b>data/</b> konnten nicht gelesen werden. ' +
        'Beim Öffnen als lokale Datei blockiert der Browser das — die App muss über eine ' +
        'Adresse aufgerufen werden.</div></div>';
      return;
    }
    this.go('home');
  },

  go(screen, arg) {
    this.screen = screen;
    this.arg = arg;
    this.render();
    const v = this.el.querySelector('.view');
    if (v) v.scrollTop = 0;
  },

  render() {
    const s = this.screen;
    if (s === 'home') this.el.innerHTML = Home.view();
    else if (s === 'session') this.el.innerHTML = Run.view();
    else if (s === 'library') this.el.innerHTML = Library.view();
    else if (s === 'profile') this.el.innerHTML = Profile.view();
    else if (s === 'legal') this.el.innerHTML = Legal.view();
    else if (s === 'grammar') this.el.innerHTML = Library.chapter(this.arg);
    else if (s === 'words') this.el.innerHTML = Library.wordList();
    bindAll();
  },
};

/* ---------- Bausteine ---------- */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Diakritika im Wort hervorheben
function marked(word) {
  return esc(word).replace(/[ďťňľšččžáéíóúýôäĺŕ]/gi,
    m => '<span class="dia">' + m + '</span>');
}

function ring(pct, size, stroke) {
  size = size || 78; stroke = stroke || 6;
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(pct, 100) / 100);
  return '<svg width="' + size + '" height="' + size + '">' +
    '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r +
    '" fill="none" stroke="var(--cobalt-wash)" stroke-width="' + stroke + '"/>' +
    '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r +
    '" fill="none" stroke="var(--cobalt)" stroke-width="' + stroke +
    '" stroke-dasharray="' + c + '" stroke-dashoffset="' + off +
    '" stroke-linecap="round" style="transition:stroke-dashoffset .6s"/></svg>';
}

const ICON = {
  speak: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
  mic: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg>',
  home: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5"/></svg>',
  book: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4h6a3 3 0 0 1 2 3v14a2.5 2.5 0 0 0-2.5-2H4z"/><path d="M20 4h-6a3 3 0 0 0-2 3v14a2.5 2.5 0 0 1 2.5-2H20z"/></svg>',
  user: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c1.4-3.7 4.1-5.5 7.5-5.5s6.1 1.8 7.5 5.5"/></svg>',
  back: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>',
  down: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
};

function navbar(active) {
  const item = (id, label, icon) =>
    '<button data-go="' + id + '" class="' + (active === id ? 'on' : '') + '">' +
    icon + '<span>' + label + '</span></button>';
  return '<div class="nav">' +
    item('home', 'Lernen', ICON.home) +
    item('library', 'Bibliothek', ICON.book) +
    item('profile', 'Profil', ICON.user) +
    '</div>';
}

/* ---------- Start ---------- */
const Home = {
  view() {
    const d = Store.day();
    const goal = Store.data.settings.goal;
    const done = d.sessions > 0;
    const pct = done ? 100 : Math.min(100, Math.round(d.seen / goal * 100));
    const streak = Stats.streak();
    const lvl = Session.level(DB);

    const counts = this.preview();

    return '<div class="safe-top"></div><div class="view fade">' +
      '<div class="hero">' +
        '<div class="display">Dnes</div>' +
        '<div class="small" style="margin-top:7px;">heute &middot; Stufe ' + lvl + '</div>' +
      '</div>' +

      '<div class="plan"><div class="panel">' +
        '<div class="plan-row"><span class="dot"></span>' + counts.fresh + ' neue Wörter</div>' +
        '<div class="plan-row"><span class="dot soft"></span>' + counts.due + ' Wiederholungen</div>' +
        '<div class="plan-row"><span class="dot ochre"></span>' + counts.speak + ' zum Sprechen</div>' +
      '</div></div>' +

      '<div style="padding:20px var(--pad) 0;display:flex;align-items:center;gap:18px;">' +
        '<div class="ring">' + ring(pct, 74, 6) +
          '<div class="ring-in">' + (done
            ? '<div style="font-size:22px;color:var(--good);">&#10003;</div>'
            : '<div style="font-size:19px;font-weight:680;">' + d.seen + '</div>' +
              '<div class="tiny">von ' + goal + '</div>') + '</div></div>' +
        '<div style="flex:1;">' +
          '<div class="small">Heute geübt</div>' +
          '<div class="body" style="font-weight:600;margin-top:2px;">' +
            (done ? 'Für heute erledigt' : d.seen ? 'Session läuft' : 'Noch nichts geübt') + '</div>' +
          (streak > 0 ? '<div class="tiny" style="color:var(--ochre);margin-top:4px;">' +
            streak + (streak === 1 ? ' Tag' : ' Tage') + ' in Folge</div>' : '') +
        '</div>' +
      '</div>' +

      '<div class="spacer"></div></div>' +

      '<div class="bottom">' +
        '<button class="btn" data-start>Session starten</button>' +
      '</div>' + navbar('home');
  },

  preview() {
    const W = Store.data.words;
    const rank = LVL_RANK[Session.level(DB)];
    const due = DB.vocab.filter(v => Leitner.seen(W, v.id) && Leitner.isDue(W[v.id])).length;
    const fresh = DB.vocab.filter(v => !Leitner.seen(W, v.id) && LVL_RANK[v.level] <= rank).length;
    return {
      due: Math.min(due, 10),
      fresh: Math.min(fresh, 7),
      speak: Listen.available || window.MediaRecorder ? 3 : 2,
    };
  },
};

/* ---------- Session ---------- */
const Run = {
  items: [], i: 0, phase: 'q', picked: null, built: [], heard: '', verdict: null,
  right: 0, wrong: 0,

  start() {
    this.items = Session.build(DB);
    this.i = 0; this.right = 0; this.wrong = 0;
    this.reset();
    if (!this.items.length) { App.go('home'); return; }
    this.prep();
    App.go('session');
  },

  reset() { this.phase = 'q'; this.picked = null; this.built = []; this.heard = ''; this.verdict = null; },

  cur() { return this.items[this.i]; },

  prep() {
    const it = this.cur();
    if (!it) return;
    if (it.kind === 'choice' || it.kind === 'recall') it.q = Make.choice(it.word, DB);
    if (it.kind === 'build') it.q = Make.build(it.sent, DB);
  },

  answer(ok, id, map, level) {
    const m = map || Store.data.words;
    if (ok) { this.right++; Leitner.promote(m, id); Leitner.raise(m, id, level); }
    else { this.wrong++; Leitner.demote(m, id); }
    const d = Store.day();
    d.seen++; if (ok) d.right++;
    Store.save();
  },

  next() {
    this.i++;
    this.reset();
    if (this.i >= this.items.length) {
      Store.day().sessions++;     // Session abgeschlossen — zaehlt fuer die Serie
      Store.save();
      App.go('session');
      return;
    }
    this.prep();
    App.render();
  },

  view() {
    if (this.i >= this.items.length) return this.done();
    const it = this.cur();
    const pct = Math.round(this.i / this.items.length * 100);

    const top = '<div class="safe-top"></div>' +
      '<div class="sess-top"><button class="sess-x" data-quit>&times;</button>' +
      '<span class="track"><i style="width:' + pct + '%"></i></span>' +
      '<span class="tiny num">' + (this.i + 1) + '/' + this.items.length + '</span></div>';

    let body = '';
    if (it.kind === 'intro') body = this.intro(it);
    else if (it.kind === 'choice' || it.kind === 'recall') body = this.choice(it);
    else if (it.kind === 'type') body = this.type(it);
    else if (it.kind === 'build') body = this.build(it);
    else if (it.kind === 'dictation') body = this.dictation(it);
    else if (it.kind === 'speak') body = this.speak(it);
    else body = this.phrase(it);

    return top + body;
  },

  /* --- neue Vokabel vorstellen --- */
  intro(it) {
    const v = it.word;
    const ex = v.ex ? DB.sentById[v.ex] : null;
    const long = v.sk.length > 13 ? ' long' : '';
    return '<div class="view fade"><div class="view-pad">' +
      '<div class="muted center" style="margin:6px 0 14px;">Neues Wort</div>' +
      '<div class="wordcard">' +
        '<button class="speak" data-say="' + esc(v.sk) + '">' + ICON.speak + '</button>' +
        '<span class="chip">' + esc(v.level) + '</span>' +
        '<div class="word' + long + '" style="margin-top:14px;">' + marked(v.sk) + '</div>' +
        '<div class="gloss">' + esc(v.de) + '</div>' +
      '</div>' +
      (ex ? '<div class="card" style="margin-top:12px;">' +
        '<div class="tiny" style="margin-bottom:5px;">Im Satz</div>' +
        '<div class="body" style="font-weight:560;">' + esc(ex.sk) + '</div>' +
        '<div class="small" style="margin-top:2px;">' + esc(ex.de) + '</div></div>' : '') +
      '<div class="spacer"></div></div></div>' +
      '<div class="bottom"><button class="btn" data-intro-ok>Verstanden</button></div>';
  },

  /* --- Mehrfachauswahl --- */
  choice(it) {
    const q = it.q, v = it.word, shown = this.phase === 'a';
    const opts = q.options.map(o => {
      let cls = 'opt';
      if (shown) {
        if (o === q.answer) cls += ' right';
        else if (o === this.picked) cls += ' wrong';
        else cls += ' dim';
      }
      return '<button class="' + cls + '" data-pick="' + esc(o) + '">' +
        '<span class="opt-in"><span>' + esc(o) + '</span>' +
        (shown && o === q.answer ? '<span>&#10003;</span>' : '') + '</span></button>';
    }).join('');

    return '<div class="view fade"><div class="view-pad">' +
      '<div class="muted center" style="margin:6px 0 16px;">' +
        (q.dir === 'de2sk' ? 'Wie heißt das auf Slowakisch?' : 'Was bedeutet das?') + '</div>' +
      '<div class="wordcard" style="min-height:150px;">' +
        (q.dir === 'sk2de' ? '<button class="speak" data-say="' + esc(v.sk) + '">' + ICON.speak + '</button>' : '') +
        '<div class="word' + (q.ask.length > 13 ? ' long' : '') + '">' + marked(q.ask) + '</div>' +
      '</div>' +
      '<div class="opts" style="margin-top:16px;">' + opts + '</div>' +
      '<div class="spacer"></div></div></div>' +
      (shown ? '<div class="bottom"><button class="btn" data-next>Weiter</button></div>' : '');
  },

  /* --- frei eintippen --- */
  type(it) {
    const v = it.word, shown = this.phase === 'a';
    const cls = shown ? (this.verdict === 'wrong' ? ' wrong' : ' right') : '';
    return '<div class="view fade"><div class="view-pad">' +
      '<div class="muted center" style="margin:6px 0 16px;">Schreib das slowakische Wort</div>' +
      '<div class="wordcard" style="min-height:130px;">' +
        '<div class="word' + (v.de.length > 13 ? ' long' : '') + '">' + esc(v.de) + '</div>' +
      '</div>' +
      '<input class="field' + cls + '" id="typed" style="margin-top:16px;" ' +
        'autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" ' +
        'placeholder="slowakisch…" ' + (shown ? 'disabled value="' + esc(this.picked || '') + '"' : '') + '>' +
      (shown ? this.feedback(this.verdict, this.picked, v.sk, v.de) : '') +
      '<div class="spacer"></div></div></div>' +
      '<div class="bottom">' +
        (shown ? '<button class="btn" data-next>Weiter</button>'
               : '<button class="btn" data-check-type>Prüfen</button>') +
      '</div>';
  },

  /* --- Wortbausteine --- */
  build(it) {
    const q = it.q, shown = this.phase === 'a';
    const slotCls = shown ? (this.verdict === 'wrong' ? ' wrong' : ' right') : '';
    const slots = this.built.map((w, i) =>
      '<button class="slot" data-unslot="' + i + '">' + esc(w) + '</button>').join('');
    const used = this.built.slice();
    const bank = q.bank.map((w, i) => {
      const k = used.indexOf(w);
      const isUsed = k >= 0;
      if (isUsed) used.splice(k, 1);
      return '<button class="bankword' + (isUsed ? ' used' : '') + '" ' +
        (isUsed ? 'disabled' : 'data-slot="' + esc(w) + '"') + '>' + esc(w) + '</button>';
    }).join('');

    return '<div class="view fade"><div class="view-pad">' +
      '<div class="muted" style="margin:6px 0 14px;">Bau den Satz</div>' +
      '<div class="prompt">' + esc(it.sent.de) + '</div>' +
      '<div class="slots' + slotCls + '">' + slots + '</div>' +
      (shown ? this.feedback(this.verdict, this.built.join(' '), q.target, it.sent.de)
             : '<div class="bank" style="margin-top:18px;">' + bank + '</div>') +
      '<div class="spacer"></div></div></div>' +
      '<div class="bottom">' +
        (shown ? '<button class="btn" data-next>Weiter</button>'
               : '<button class="btn" data-check-build ' +
                 (this.built.length ? '' : 'disabled') + '>Prüfen</button>') +
      '</div>';
  },

  /* --- Diktat --- */
  dictation(it) {
    const shown = this.phase === 'a';
    const cls = shown ? (this.verdict === 'wrong' ? ' wrong' : ' right') : '';
    return '<div class="view fade"><div class="view-pad">' +
      '<div class="muted center" style="margin:6px 0 18px;">Hör zu und schreib mit</div>' +
      '<div class="center" style="margin-bottom:8px;">' +
        '<button class="mic" data-say="' + esc(it.sent.sk) + '">' + ICON.mic + '</button></div>' +
      '<div class="tiny center" style="margin-bottom:16px;">Antippen zum Anhören</div>' +
      '<input class="field' + cls + '" id="typed" autocomplete="off" autocapitalize="off" ' +
        'autocorrect="off" spellcheck="false" placeholder="was du hörst…" ' +
        (shown ? 'disabled value="' + esc(this.picked || '') + '"' : '') + '>' +
      (shown ? this.feedback(this.verdict, this.picked, it.sent.sk, it.sent.de) : '') +
      '<div class="spacer"></div></div></div>' +
      '<div class="bottom">' +
        (shown ? '<button class="btn" data-next>Weiter</button>'
               : '<button class="btn" data-check-dict>Prüfen</button>') +
      '</div>';
  },

  /* --- Nachsprechen --- */
  speak(it) {
    const p = it.phrase, shown = this.phase === 'a';
    const live = Listen.active;
    return '<div class="view fade"><div class="view-pad">' +
      '<div class="muted center" style="margin:6px 0 16px;">Sprich nach</div>' +
      '<div class="wordcard" style="min-height:140px;">' +
        '<button class="speak" data-say="' + esc(p.sk) + '">' + ICON.speak + '</button>' +
        '<div class="word' + (p.sk.length > 15 ? ' long' : '') + '">' + marked(p.sk) + '</div>' +
        '<div class="gloss" style="font-size:16px;">' + esc(p.de) + '</div>' +
      '</div>' +
      '<div class="heard" style="margin-top:18px;">' + esc(this.heard) + '</div>' +
      '<div class="center" style="margin-top:14px;">' +
        '<button class="mic' + (live ? ' live' : '') + '" data-listen ' +
          (Listen.available ? '' : 'disabled') + '>' + ICON.mic + '</button></div>' +
      '<div class="tiny center" style="margin-top:12px;">' +
        (Listen.available
          ? (live ? 'Ich höre zu…' : 'Antippen und sprechen')
          : 'Spracherkennung steht auf diesem Gerät nicht bereit') + '</div>' +
      (shown ? this.feedback(this.verdict, this.heard, p.sk, p.de) : '') +
      '<div class="spacer"></div></div></div>' +
      '<div class="bottom">' +
        (shown ? '<button class="btn" data-next>Weiter</button>'
               : '<button class="btn-soft" data-skip-speak>Überspringen</button>') +
      '</div>';
  },

  /* --- Phrase ohne Mikrofon --- */
  phrase(it) {
    const p = it.phrase;
    return '<div class="view fade"><div class="view-pad">' +
      '<div class="muted center" style="margin:6px 0 16px;">Redewendung</div>' +
      '<div class="wordcard">' +
        '<button class="speak" data-say="' + esc(p.sk) + '">' + ICON.speak + '</button>' +
        '<span class="chip">' + esc(p.context) + '</span>' +
        '<div class="word' + (p.sk.length > 15 ? ' long' : '') + '" style="margin-top:14px;">' +
          marked(p.sk) + '</div>' +
        '<div class="gloss" style="font-size:17px;">' + esc(p.de) + '</div>' +
      '</div><div class="spacer"></div></div></div>' +
      '<div class="bottom"><button class="btn" data-phrase-ok>Verstanden</button></div>';
  },

  /* --- Rückmeldung --- */
  feedback(verdict, said, target, gloss) {
    if (verdict === 'exact') {
      return '<div class="fb good" style="margin-top:14px;">' +
        '<div class="fb-t">Richtig</div>' +
        '<div class="fb-d">' + esc(target) + ' — ' + esc(gloss) + '</div></div>';
    }
    if (verdict === 'diacritics') {
      const marks = Text.missedMarks(said, target);
      const tips = marks.filter(m => SOUNDS[m])
        .map(m => '<b>' + m + '</b> ' + SOUNDS[m]).join(' &middot; ');
      return '<div class="fb warn" style="margin-top:14px;">' +
        '<div class="fb-t">Fast — die Zeichen fehlen</div>' +
        '<div class="fb-d">Richtig ist <b>' + esc(target) + '</b>.' +
        (tips ? '<br>' + tips : '') + '</div></div>';
    }
    if (verdict === 'close') {
      return '<div class="fb warn" style="margin-top:14px;">' +
        '<div class="fb-t">Fast richtig</div>' +
        '<div class="fb-d">Richtig ist <b>' + esc(target) + '</b> — ' + esc(gloss) + '</div></div>';
    }
    return '<div class="fb bad" style="margin-top:14px;">' +
      '<div class="fb-t">Noch nicht</div>' +
      '<div class="fb-d">Richtig ist <b>' + esc(target) + '</b> — ' + esc(gloss) + '</div></div>';
  },

  /* --- Abschluss --- */
  done() {
    const total = this.right + this.wrong;
    const pct = total ? Math.round(this.right / total * 100) : 0;
    const mark = pct === 100 ? '&#11088;' : pct >= 80 ? '&#127881;' : pct >= 60 ? '&#128077;' : '&#128218;';
    const newly = Stats.learnedToday();
    return '<div class="safe-top"></div><div class="view pop"><div class="result">' +
      '<div class="result-mark">' + mark + '</div>' +
      '<div class="title" style="margin-bottom:10px;">Session beendet</div>' +
      '<div class="result-pct" style="color:' +
        (pct >= 80 ? 'var(--good)' : pct >= 60 ? 'var(--ochre)' : 'var(--bad)') + '">' + pct + '%</div>' +
      '<div class="small" style="margin-top:4px;">' + this.right + ' von ' + total + ' richtig</div>' +
      (newly ? '<div class="panel" style="margin-top:24px;text-align:left;">' +
        '<div class="body"><b>' + newly + '</b> ' +
        (newly === 1 ? 'Wort ist' : 'Wörter sind') + ' heute ins Langzeitgedächtnis gewandert.</div>' +
        '</div>' : '') +
      '</div></div>' +
      '<div class="bottom"><div class="btn-row">' +
        '<button class="btn-line" data-go="home">Schluss</button>' +
        '<button class="btn wide" data-start>Noch eine</button>' +
      '</div></div>';
  },
};

/* ---------- Bibliothek ---------- */
const Library = {
  tab: 'woerter',

  view() {
    const t = this.tab;
    return '<div class="safe-top"></div>' +
      '<div class="appbar"><div class="title">Bibliothek</div></div>' +
      '<div style="padding:14px var(--pad) 12px;">' +
        '<div class="seg">' +
          ['woerter', 'saetze', 'phrasen', 'grammatik'].map(k =>
            '<button data-tab="' + k + '" class="' + (t === k ? 'on' : '') + '">' +
            ({ woerter: 'Wörter', saetze: 'Sätze', phrasen: 'Phrasen', grammatik: 'Grammatik' })[k] +
            '</button>').join('') +
        '</div>' +
      '</div>' +
      '<div class="view"><div class="view-pad">' +
        (t === 'woerter' ? this.words() :
         t === 'saetze' ? this.sentences() :
         t === 'phrasen' ? this.phrases() : this.grammar()) +
        '<div class="spacer"></div></div></div>' + navbar('library');
  },

  words() {
    const W = Store.data.words;
    const groups = [
      ['Im Langzeitgedächtnis', v => W[v.id] && W[v.id].box >= MASTER_BOX],
      ['In Arbeit', v => W[v.id] && W[v.id].box < MASTER_BOX],
      ['Noch nicht begonnen', v => !W[v.id]],
    ];
    let out = '<button class="tile" data-go="words" style="margin-bottom:14px;">' +
      '<div class="head">Alle Wörter durchsehen</div>' +
      '<div class="small">' + DB.vocab.length + ' Einträge, durchsuchbar</div></button>';
    groups.forEach(([label, fn]) => {
      const n = DB.vocab.filter(fn).length;
      out += '<div class="row"><div class="row-main"><div class="row-sk">' + label + '</div></div>' +
        '<span class="chip">' + n + '</span></div>';
    });
    const b = Stats.byBox();
    out += '<div class="head" style="margin:26px 0 10px;">Verteilung nach Kasten</div>';
    for (let i = 1; i <= 5; i++) {
      const pct = Stats.touched() ? Math.round(b[i] / Stats.touched() * 100) : 0;
      out += '<div style="margin-bottom:11px;">' +
        '<div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:4px;">' +
        '<span>Kasten ' + i + '<span class="tiny"> &middot; alle ' + INTERVALS[i] + ' Tage</span></span>' +
        '<span class="num" style="color:var(--ink-3);">' + b[i] + '</span></div>' +
        '<div class="tile-bar"><i style="width:' + pct + '%"></i></div></div>';
    }
    return out;
  },

  wordList() {
    const W = Store.data.words;
    const rows = DB.vocab.map(v => {
      const st = W[v.id];
      const cls = st ? (st.box >= MASTER_BOX ? '' : ' ochre') : ' plain';
      const lab = st ? 'Kasten ' + st.box : v.level;
      return '<div class="row" data-word="' + esc(v.sk) + '">' +
        '<div class="row-main"><div class="row-sk">' + marked(v.sk) + '</div>' +
        '<div class="row-de">' + esc(v.de) + '</div></div>' +
        '<span class="chip' + cls + '">' + lab + '</span>' +
        '<button class="speak" style="position:static;width:36px;height:36px;" ' +
        'data-say="' + esc(v.sk) + '">' + ICON.speak + '</button></div>';
    }).join('');
    return '<div class="safe-top"></div>' +
      '<div class="appbar"><button class="iconbtn" data-go="library">' + ICON.back + '</button>' +
      '<div class="head">Alle Wörter</div><div style="width:38px;"></div></div>' +
      '<div style="padding:14px var(--pad) 10px;">' +
        '<input class="search" id="wsearch" placeholder="Suchen…" autocomplete="off"></div>' +
      '<div class="view"><div class="view-pad" id="wlist">' + rows +
      '<div class="spacer"></div></div></div>';
  },

  sentences() {
    const open = DB.sentences.filter(s => Session.unlocked(s));
    let out = '<div class="small" style="margin-bottom:14px;">' + open.length +
      ' von ' + DB.sentences.length + ' Sätzen freigeschaltet. Ein Satz erscheint, ' +
      'sobald du seine Wörter kennst.</div>';
    out += open.slice(0, 120).map(s =>
      '<div class="row"><div class="row-main">' +
      '<div class="row-sk" style="font-weight:560;">' + esc(s.sk) + '</div>' +
      '<div class="row-de">' + esc(s.de) + '</div></div>' +
      '<button class="speak" style="position:static;width:36px;height:36px;" ' +
      'data-say="' + esc(s.sk) + '">' + ICON.speak + '</button></div>').join('');
    if (!open.length) out += '<div class="card center"><div class="small">' +
      'Noch keine Sätze frei. Lerne ein paar Wörter, dann erscheinen sie hier.</div></div>';
    return out;
  },

  phrases() {
    const ctx = [];
    DB.phrases.forEach(p => { if (!ctx.includes(p.context)) ctx.push(p.context); });
    return ctx.map(c =>
      '<div class="head" style="margin:20px 0 6px;">' + esc(c) + '</div>' +
      DB.phrases.filter(p => p.context === c).map(p =>
        '<div class="row"><div class="row-main">' +
        '<div class="row-sk" style="font-weight:560;">' + marked(p.sk) + '</div>' +
        '<div class="row-de">' + esc(p.de) + '</div></div>' +
        '<button class="speak" style="position:static;width:36px;height:36px;" ' +
        'data-say="' + esc(p.sk) + '">' + ICON.speak + '</button></div>').join('')
    ).join('');
  },

  grammar() {
    return DB.grammar.map(g =>
      '<button class="tile" data-chapter="' + esc(g.id) + '" style="margin-bottom:9px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
      '<div><div class="head">' + esc(g.title) + '</div>' +
      '<div class="small">' + esc(g.description) + '</div></div>' +
      '<span class="chip">' + esc(g.level) + '</span></div></button>').join('');
  },

  chapter(id) {
    const g = DB.grammar.find(x => x.id === id) || DB.grammar[0];
    const rows = g.table.map(r =>
      '<tr><td style="color:var(--ink-2);">' + esc(r[0]) + '</td>' +
      '<td>' + marked(r[1]) + '</td></tr>').join('');
    return '<div class="safe-top"></div>' +
      '<div class="appbar"><button class="iconbtn" data-go="library">' + ICON.back + '</button>' +
      '<div class="head">Grammatik</div><div style="width:38px;"></div></div>' +
      '<div class="view fade"><div class="view-pad" style="padding-top:16px;">' +
        '<div class="title">' + esc(g.title) + '</div>' +
        '<div class="small" style="margin-top:3px;">' + esc(g.description) + '</div>' +
        '<div class="card" style="margin-top:16px;padding:4px 18px 10px;">' +
          '<table class="gtable">' + rows + '</table></div>' +
        '<div class="tipbox">' + esc(g.tip) + '</div>' +
        '<div class="spacer"></div></div></div>';
  },
};

/* ---------- Profil ---------- */
const Profile = {
  view() {
    const m = Stats.mastered(), t = Stats.touched();
    const c = Stats.cefr();
    const pct = Math.round(c.at / c.next * 100);
    const heat = [];
    for (let i = 29; i >= 0; i--) {
      const k = Store.dayKey(-i);
      const d = Store.data.days[k];
      const q = !d ? 0 : d.seen >= Store.data.settings.goal ? 3 : d.seen >= 10 ? 2 : 1;
      heat.push('<i class="q' + q + (i === 0 ? ' today' : '') + '"></i>');
    }
    return '<div class="safe-top"></div>' +
      '<div class="appbar"><div class="title">Profil</div>' +
      '<button class="iconbtn" data-go="legal"><span style="font-size:16px;">&sect;</span></button></div>' +
      '<div class="view"><div class="view-pad" style="padding-top:18px;">' +

      '<div class="panel" style="display:flex;align-items:center;gap:18px;">' +
        '<div class="ring">' + ring(pct, 84, 7) +
        '<div class="ring-in"><div style="font-size:18px;font-weight:680;">' + m + '</div></div></div>' +
        '<div style="flex:1;">' +
          '<div class="head">' + c.label + '</div>' +
          '<div class="small" style="margin-top:2px;">' + m + ' von ' + c.next +
          ' Wörtern im Langzeitgedächtnis</div></div></div>' +

      '<div class="stat-row" style="margin-top:12px;">' +
        '<div class="stat"><b>' + Stats.streak() + '</b><span class="tiny">Tage in Folge</span></div>' +
        '<div class="stat"><b>' + Stats.learnedToday() + '</b><span class="tiny">heute gefestigt</span></div>' +
        '<div class="stat"><b>' + Stats.accuracy() + '%</b><span class="tiny">Treffer</span></div>' +
      '</div>' +

      '<div class="head" style="margin:26px 0 10px;">Letzte 30 Tage</div>' +
      '<div class="heat">' + heat.join('') + '</div>' +

      '<div class="head" style="margin:26px 0 10px;">Wortschatz</div>' +
      '<div class="card">' +
        '<div class="row"><div class="row-main"><div class="row-sk">Begonnen</div></div>' +
        '<span class="chip">' + t + '</span></div>' +
        '<div class="row"><div class="row-main"><div class="row-sk">Im Langzeitgedächtnis</div></div>' +
        '<span class="chip">' + m + '</span></div>' +
        '<div class="row"><div class="row-main"><div class="row-sk">Insgesamt verfügbar</div></div>' +
        '<span class="chip plain">' + DB.vocab.length + '</span></div>' +
      '</div>' +

      '<div class="head" style="margin:26px 0 10px;">Fortschritt sichern</div>' +
      '<div class="btn-row">' +
        '<button class="btn-line" data-export>Exportieren</button>' +
        '<button class="btn-line" data-import>Importieren</button></div>' +

      '<div class="head" style="margin:26px 0 8px;">Zurücksetzen</div>' +
      '<div class="small" style="margin-bottom:12px;">Löscht alle Kästen, Serien und Statistiken. ' +
      'Nicht umkehrbar.</div>' +
      '<button class="btn-danger" data-reset>Alle Daten löschen</button>' +

      '<div class="spacer"></div></div></div>' + navbar('profile');
  },
};

/* ---------- Impressum ---------- */
const Legal = {
  view() {
    const y = new Date().getFullYear();
    const block = (t, b) => '<div class="head" style="margin:24px 0 8px;">' + t + '</div>' + b;
    return '<div class="safe-top"></div>' +
      '<div class="appbar"><button class="iconbtn" data-go="profile">' + ICON.back + '</button>' +
      '<div class="head">Impressum</div><div style="width:38px;"></div></div>' +
      '<div class="view"><div class="view-pad" style="padding-top:14px;">' +
      '<div class="small">Angaben gemäß § 25 Mediengesetz</div>' +

      block('Medieninhaber', '<div class="card"><div class="body" style="font-weight:600;">Clemens Schleinzer</div>' +
        '<div class="small" style="margin-top:5px;line-height:1.7;">Enzersdorfer Straße 9/2/2<br>' +
        '2401 Fischamend<br>Österreich</div>' +
        '<a href="mailto:schleinzer@gmail.com" style="display:block;margin-top:9px;font-size:14px;' +
        'color:var(--cobalt);text-decoration:none;">schleinzer@gmail.com</a></div>') +

      block('Zweck', '<div class="small">Nicht-kommerzielle Privatanwendung zum Erlernen der ' +
        'slowakischen Sprache, ohne Erwerbsabsicht.</div>') +

      block('Datenschutz',
        '<div class="small" style="margin-bottom:10px;">Verantwortlicher im Sinne der DSGVO: ' +
        'Clemens Schleinzer, Enzersdorfer Straße 9/2/2, 2401 Fischamend, schleinzer@gmail.com</div>' +
        '<div class="small" style="margin-bottom:10px;">Der Lernfortschritt wird ausschließlich ' +
        'lokal im Browser gespeichert und verlässt das Gerät nicht. Es werden keine Cookies gesetzt, ' +
        'kein Tracking durchgeführt und keine Analysedienste eingesetzt.</div>' +
        '<div class="small">Beim Aufruf der Seite wird Ihre IP-Adresse an den Hosting-Anbieter ' +
        'übertragen. Externe Programmbibliotheken werden nicht geladen.</div>') +

      block('Spracherkennung',
        '<div class="card" style="background:var(--ochre-wash);">' +
        '<div class="small" style="color:var(--ochre-ink);">Die Sprechübungen sind freiwillig und ' +
        'starten nur, wenn Sie das Mikrofon ausdrücklich freigeben. Dabei wird die Aufnahme zur ' +
        'Erkennung an den Sprachdienst des Geräteherstellers (Apple bzw. Google) übertragen und ' +
        'dort verarbeitet. Ohne Freigabe bleibt die Funktion inaktiv, die App ist vollständig ' +
        'ohne sie nutzbar.</div></div>') +

      block('Sprachausgabe',
        '<div class="small">Das Vorlesen erfolgt über die Sprachausgabe des Betriebssystems. ' +
        'Es werden dabei keine Daten an externe Server übertragen.</div>') +

      block('Hosting',
        '<div class="small">GitHub Pages, betrieben von GitHub, Inc., 88 Colin P Kelly Jr St, ' +
        'San Francisco, CA 94107, USA. Beim Seitenaufruf wird die IP-Adresse an GitHub übertragen.</div>') +

      block('Beschwerderecht',
        '<div class="small">Sie haben das Recht, Beschwerde bei der österreichischen ' +
        'Datenschutzbehörde einzulegen: <a href="https://www.dsb.gv.at" target="_blank" ' +
        'rel="noopener" style="color:var(--cobalt);text-decoration:none;">www.dsb.gv.at</a></div>') +

      '<div class="tiny center" style="margin-top:28px;">Stand ' + y + ' — Slovenčina</div>' +
      '<div class="spacer"></div></div></div>';
  },
};
