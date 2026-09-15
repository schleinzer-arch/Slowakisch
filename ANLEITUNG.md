# Slovenčina — neue Version hochladen

## 1 · Alte Dateien entfernen

Im Repository löschen: **index.html** (die alte Einzeldatei) und, falls noch vorhanden,
**test-speech.html**.

## 2 · Neue Dateien hochladen

Diese Struktur muss entstehen:

```
index.html
styles.css
core.js
ui.js
events.js
manifest.json
sw.js
data/vocab.json
data/sentences.json
data/phrases.json
data/grammar.json
```

Im GitHub-Web-Interface:

1. **Add file → Upload files**
2. Die sieben Dateien aus dem Hauptverzeichnis hineinziehen
3. **Commit changes**
4. Nochmal **Add file → Upload files**
5. Bei „Name your file…" zuerst `data/` eintippen — dadurch entsteht der Ordner
6. Die vier JSON-Dateien hineinziehen
7. **Commit changes**

## 3 · Prüfen

`https://slowakisch.schleinzer.app` aufrufen. Beim ersten Start ist alles bei null,
der Startbildschirm zeigt „Dnes" und einen Tagesplan.

Falls die Meldung „Daten nicht geladen" erscheint: Der Ordner `data/` fehlt oder
die Dateien liegen direkt im Hauptverzeichnis.

## 4 · Alte App-Kachel ersetzen

Die frühere Kachel auf dem Homescreen zeigt noch auf die alte Fassung.
Löschen und die Seite neu zum Homescreen hinzufügen.

## Was sich geändert hat

**Struktur.** Statt sechs Reitern gibt es Lernen, Bibliothek und Profil.
Flashcards, Quiz und Anki sind keine eigenen Orte mehr, sondern Übungsarten
innerhalb einer Session.

**Fünf Übungsarten**, die sich innerhalb einer Session abwechseln: neues Wort
vorstellen, Mehrfachauswahl, freies Eintippen, Satz aus Wortbausteinen bauen,
Diktat nach Gehör, Phrase nachsprechen.

**Kastensystem.** Jedes Wort wandert bei richtiger Antwort einen Kasten höher
(1 Tag, 3 Tage, 1 Woche, 2 Wochen, 5 Wochen), bei falscher zurück auf Kasten 1.
Ab Kasten 4 gilt ein Wort als im Langzeitgedächtnis — das ist die Zahl im Profil.

**Steigende Anforderung.** Kasten 1 und 2 fragen per Mehrfachauswahl ab,
ab Kasten 3 musst du das Wort selbst schreiben.

**Sätze schalten sich frei**, sobald du ihre Wörter kennst — oder wenn höchstens
ein Wort darin noch unbekannt ist.

**Nachsprechen** mit Bewertung in drei Stufen: richtig, fast richtig mit Hinweis
auf verschluckte Diakritika, oder nochmal.

**Ohne externe Bibliotheken.** Kein React, kein CDN. Dadurch läuft die App offline
und es wird keine IP-Adresse mehr an Cloudflare übertragen.

## Änderungen gegenüber der ersten Fassung

**Satzaufgaben kommen später und passen.** Vorher konnte ein Satz mit nur einer
verknüpften Vokabel ab dem ersten Tag erscheinen, obwohl keines seiner Wörter
bekannt war. Jetzt gilt: mindestens zwei verknüpfte Wörter, Nachsicht bei einem
unbekannten Wort erst ab drei Verknüpfungen, Satzaufgaben überhaupt erst ab
30 sitzenden Wörtern, und auf A1 nur A1-Sätze bis sechs Wörter Länge.

**Überspringen.** Oben rechts in jeder Übung. Übersprungene Übungen werden nicht
gewertet — kein Kastenwechsel, keine Statistik, die Aufgabe kommt wieder.

**Spracherkennung wird richtig erkannt.** Firefox am Desktop hat keine, dort
entfallen die Sprechübungen vollständig und es kommen stattdessen Redewendungen
zum Anhören. Der Startbildschirm zeigt das auch so an.

**Schalter im Profil.** Nachsprechen lässt sich abschalten, wenn du an einem Ort
übst, wo du nicht laut sprechen kannst. Steht die Erkennung im Browser gar nicht
zur Verfügung, erscheint statt des Schalters ein Hinweis.

**Ablenkerwörter beim Satzbau** stammen jetzt aus denselben Wortarten wie der Satz,
nicht mehr zufällig aus dem gesamten Wortschatz.

## Zweite Überarbeitung

**Neue Wörter werden sofort geübt.** Ein Wort wird eingeführt und kommt noch in
derselben Session zweimal zurück — erst Slowakisch→Deutsch, später
Deutsch→Slowakisch. Vorher war die Einführung eine reine Anzeigekarte und das Wort
wurde erst am Folgetag abgefragt.

**Fünf neue Wörter pro Session** statt sieben. Der passive Anteil ist damit von
36 % auf 21 % gefallen.

**Eintippen ab Kasten 2** statt 3. Vorher war die Schreibstufe praktisch
unerreichbar und kam in zwölf Tagen kein einziges Mal vor.

**Neue Übungsart: Paare zuordnen.** Fünf deutsche und fünf slowakische Wörter
antippen, aus den frisch eingeführten Wörtern.

**Ablenker nur aus bekannten Wörtern.** Vorher kamen die falschen Antworten aus
dem gesamten Wortschatz — dadurch ließ sich jede Frage durch Ausschließen lösen.

**Kein Vorgriff mehr.** Das zufällige Wort aus der nächsthöheren Stufe entfällt.
Daher kam „Kühlschrank", während du noch bei „ich, du, er" warst.

**Sätze gedeckelt** auf ein Sechstel der Session, Schwelle von 30 auf 80 Wörter.

**Phrasen der Reihe nach** statt zufällig, und ohne Mikrofon als Auswahlaufgabe
statt als reine Anzeige.

**Vokabeln üben** — zweiter Knopf auf dem Startbildschirm. Endlos, immer gemischte
Richtung, keine Auswahl. Fälliges Wort richtig zählt normal, nicht fälliges richtig
zählt nicht für den Kasten, falsch zählt immer. Damit lässt sich der
Wiederholungsabstand nicht durch Pauken aushebeln. Auf die Serie wirkt es nicht.

## Dritte Überarbeitung

**Die Sofortabfrage bewegt den Kasten nicht mehr.** Vorher rückte ein neu
eingeführtes Wort durch die zwei Übungen derselben Session sofort in Kasten 3 und
war erst in sieben Tagen wieder fällig. Dadurch gab es nie Wiederholungen aus den
Vortagen, und jede Session bestand aus denselben fünf Wörtern. Jetzt bleibt ein
neues Wort in Kasten 1 und ist am Folgetag wieder dran — der Abstand wirkt erst
nach einer Nacht.

**Eine Sofortabfrage statt zwei.** Die zweite Richtung kommt am nächsten Tag.

**Mehr neue Wörter, wenn nichts zu wiederholen ist.** In den ersten Tagen führt die
App bis zu zehn Wörter ein statt fünf. Sobald genug Fälliges da ist, pendelt es
sich von allein ein.

**Paare mischen** drei neue und drei bekannte Wörter statt nur der neuen.

**Mindestabstand.** Zwischen zwei Begegnungen mit demselben Wort liegen mindestens
drei andere Aufgaben. Passt keine Stelle, entfällt die Sofortabfrage, statt
angehängt zu werden.

Gemessen: Tag 1 zehn verschiedene Wörter statt fünf, Tag 2 fünfzehn. Der passive
Anteil liegt bei 15 %, Eintippen bei 13 %.

## Wenn Änderungen nicht ankommen

Die Dateien tragen jetzt eine Versionsnummer (`ui.js?v=4`). Der Browser holt sie
dadurch neu, sobald sich die Nummer ändert. Unten im Profil steht, welche Version
gerade läuft — daran erkennst du, ob der Upload angekommen ist.

Falls trotzdem die alte Fassung erscheint:

1. In Chrome am iPhone den Tab schließen und neu öffnen
2. Bei der Homescreen-Kachel: Kachel löschen, Seite in Chrome aufrufen, neu
   zum Homescreen hinzufügen
3. Prüfen, ob im Profil unten Version 4 steht

Der Grund: Ohne Versionsnummer heißt die Datei immer gleich, und der Browser nimmt
die Fassung, die er schon hat — auch wenn auf dem Server längst eine neue liegt.

## Inhalt

1025 Vokabeln, 300 Sätze, 100 Phrasen, 14 Grammatikkapitel.

**Wortschatz überarbeitet.** Acht Dubletten entfernt: *oči*, *uši*, *zuby* waren
Pluralformen bereits vorhandener Wörter, *prepáčte*, *vitajte*, *rozumiem*,
*nerozumiem*, *neviem* standen schon in der Phrasenliste. Ergänzt: *babka*, *dedko*,
*čas*, *aj* sowie die Wendungen *Mám rád* und *Nemám rád*. *manžel*, *manželka* und
*kniha* von A2 auf A1 gesetzt.

**A1 neu geordnet.** Die Liste war nach Wortart sortiert, dadurch kamen alle
Substantive spät — *mama* stand auf Position 219, die Zahlen ab 239, die Wochentage
ab 270. Jetzt thematisch in sechzehn Blöcken: Ich und du, Familie, Haben und tun,
Zahlen, Fragen, Präpositionen, Adjektive, Essen, Ort, Zeit, Wochentage, Possessiv,
Farben, Zuhause, weitere Verben, Alltag. *mama* steht nun auf 18, die Zahlen ab 41,
die Wochentage ab 122.

**Noch gegenzulesen:** 65 der 98 Phrasen habe ich selbst ergänzt, sie sind in
`data/phrases.json` am Feld `"src": "neu"` erkennbar. Die übrigen 33 stammen aus
deiner bisherigen App.
