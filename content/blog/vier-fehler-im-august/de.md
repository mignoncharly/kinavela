---
title: Vier Fehler, die wir im August gefunden haben
excerpt: Einer davon hat Konten gelöscht. Was wir am 14. August repariert haben und warum es kaputt war.
author: charles
published: 2099-01-01
originalLocale: de
---

Am 14. August haben wir vier Dinge repariert. Einer davon hätte nie passieren
dürfen.

Wer das Anmeldeformular zweimal abgeschickt hat — weil die Seite langsam war,
weil man nicht sicher war, ob der erste Klick angekommen ist — dessen zweiter
Versuch hat das Konto gelöscht, das der erste angelegt hatte. Nicht gesperrt.
Gelöscht.

Der Grund ist unspektakulär und deshalb umso ärgerlicher. Bei einer noch nicht
bestätigten E-Mail-Adresse hat unser Anmeldedienst den Bestätigungslink neu
erzeugt, statt die Anfrage abzulehnen. Die Anfrage lief danach weiter, stolperte
über eine Eindeutigkeitsregel in der Einwilligungstabelle und löste ein Rollback
aus. Das Rollback nahm ein Konto mit, das diese Anfrage nie erstellt hatte.

Wir wissen nicht, wie viele Menschen davon betroffen waren. Das ist der Teil,
der bleibt.

## Wer in Schrobenhausen wohnt, kam nicht rein

Kinavela hatte eine Pilotgrenze: eine Obergrenze für aktive Familien und eine
Liste freigeschalteter Orte. Wer in Schrobenhausen, Aresing, Manching oder
Karlskron wohnte, konnte die Anmeldung nicht abschließen. Nicht weil dort etwas
fehlte, sondern weil der Ort nicht einzeln eingetragen war.

Gedacht war das als Vorsicht. Angekommen ist es als Ablehnung. Und es traf
ausgerechnet die Familien, für die das hier gebaut ist — die wohnen nämlich oft
nicht in Berlin oder München.

Die Regel heißt jetzt: Wer eine gültige Adresse in Deutschland auswählt, kommt
rein. Der Datenbank-Trigger, der das verhindert hat, ist gelöscht.

## Der Regler hat gelogen

In der Anmeldung stellt man ein, wie weit entfernt andere Familien wohnen
dürfen. Wer die Anmeldung unterbrochen und später fortgesetzt hat, sah daneben
"40 km" stehen — unabhängig davon, wo der Regler tatsächlich stand.

Wir hatten die gespeicherten Werte direkt in die Formularfelder geschrieben,
ohne React davon zu erzählen. Die Anzeige blieb bei ihrem Startwert. Man hat
also etwas anderes abgeschickt als das, was man gelesen hat.

## Das Feld, das nichts gesagt hat

Bei der Ortssuche muss man tippen und danach einen Treffer aus der Liste
auswählen. Viele haben getippt und sind weitergegangen. Das Feld sah ja
ausgefüllt aus.

Jetzt steht ein Satz darunter: "Suchen und den Ort danach aus der Liste
auswählen." Neun Wörter. Die hätten wir von Anfang an hinschreiben können.
