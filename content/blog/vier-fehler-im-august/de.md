---
title: Vier Fehler, die Familien nicht hätten treffen dürfen
excerpt: Am 14. August haben wir vier Fehler behoben. Was sie für Familien bedeuteten und warum wir bei Kinavela offen darüber sprechen.
author: admin
published: 2026-08-15
originalLocale: de
tags: [familie, vertrauen, hinter-den-kulissen]
---

Am 14. August haben wir vier Fehler repariert. Einer davon hätte nie passieren
dürfen: Wer das Anmeldeformular zweimal abgeschickt hat, konnte dadurch das
gerade angelegte Konto wieder verlieren.

Ein zweiter Klick ist kein ungewöhnliches Verhalten. Man klickt noch einmal,
wenn eine Seite langsam ist oder man nicht weiß, ob der erste Versuch
angekommen ist. Bei Kinavela führte genau das dazu, dass ein unbestätigtes Konto
gelöscht wurde. Nicht gesperrt. Gelöscht.

Der Grund ist unspektakulär und deshalb umso ärgerlicher. Bei einer noch nicht
bestätigten E-Mail-Adresse hat unser Anmeldedienst den Bestätigungslink neu
erzeugt, statt die Anfrage abzulehnen. Die Anfrage lief danach weiter, stolperte
über eine Eindeutigkeitsregel in der Einwilligungstabelle und löste ein Rollback
aus. Das Rollback nahm ein Konto mit, das diese Anfrage nie erstellt hatte.

Wir wissen nicht, wie viele Menschen davon betroffen waren. Dieser Satz fällt
mir nicht leicht. Eine Plattform für Familien darf bei solchen Fehlern nicht so
tun, als wäre nur eine technische Kleinigkeit schiefgegangen.

## Manche Orte waren draußen

Kinavela hatte eine Pilotgrenze: eine Obergrenze für aktive Familien und eine
Liste freigeschalteter Orte. Wer in Schrobenhausen, Aresing, Manching oder
Karlskron wohnte, konnte die Anmeldung nicht abschließen. Nicht weil dort etwas
fehlte, sondern weil der Ort nicht einzeln eingetragen war.

Gedacht war das als vorsichtiger Start. Angekommen ist es als Ablehnung. Das
passt nicht zu Kinavela. Familien in der Diaspora leben nicht nur in Berlin
oder München. Sie leben auch in kleineren Städten und Gemeinden und sollen
einander dort finden können, wo ihr Alltag stattfindet.

Die Regel heißt jetzt: Wer eine gültige Adresse in Deutschland auswählt, kommt
rein. Der Datenbank-Trigger, der das verhindert hat, ist gelöscht.

## Der Regler hat gelogen

In der Anmeldung stellt man ein, wie weit entfernt andere Familien wohnen
dürfen. Wer die Anmeldung unterbrochen und später fortgesetzt hat, sah daneben
"40 km" stehen — unabhängig davon, wo der Regler tatsächlich stand.

Die Anzeige blieb bei ihrem Startwert, obwohl im Hintergrund etwas anderes
gespeichert war. Man hat also nicht unbedingt das abgeschickt, was man auf dem
Bildschirm gelesen hatte. Gerade bei der Frage, wie nah andere Familien sein
dürfen, muss die eigene Entscheidung sichtbar und verlässlich sein.

## Das Feld, das nichts gesagt hat

Bei der Ortssuche muss man tippen und danach einen Treffer aus der Liste
auswählen. Viele haben getippt und sind weitergegangen. Das Feld sah ja
ausgefüllt aus.

Jetzt steht ein Satz darunter: "Suchen und den Ort danach aus der Liste
auswählen." Neun Wörter. Die hätten wir von Anfang an hinschreiben können.

## Warum wir das öffentlich machen

Kinavela soll Familien helfen, vertrauensvolle Verbindungen in ihrer Nähe
aufzubauen und kulturelle Wurzeln mit ihren Kindern weiterzugeben. Bevor daraus
Begegnungen entstehen, müssen schon die ersten Schritte fair, verständlich und
verlässlich sein.

Ich kann nicht versprechen, dass wir nie wieder einen Fehler machen. Ich kann
aber versprechen, dass wir Fehler nicht hinter technischen Begriffen
verstecken. Wir benennen, was für Menschen schiefgegangen ist, reparieren es
und erzählen, was wir daraus gelernt haben.
