---
title: Quatre erreurs qui n’auraient jamais dû toucher les familles
excerpt: Le 14 août, nous avons corrigé quatre erreurs. Ce qu’elles signifiaient pour les familles et pourquoi Kinavela en parle ouvertement.
author: charles
published: 2026-08-15
originalLocale: de
tags: [famille, confiance, coulisses]
---

Le 14 août, nous avons corrigé quatre erreurs. L’une d’elles n’aurait jamais dû
se produire : envoyer deux fois le formulaire d’inscription pouvait faire
disparaître le compte qui venait d’être créé.

Cliquer une seconde fois n’a rien d’inhabituel. On le fait lorsqu’une page est
lente ou que l’on ne sait pas si le premier clic a bien été pris en compte.
Chez Kinavela, ce deuxième clic pouvait supprimer un compte qui n’avait pas
encore été confirmé. Pas le bloquer. Le supprimer.

La cause est peu spectaculaire, et c’est justement ce qui la rend si
agaçante. Pour une adresse e-mail non confirmée, notre service d’inscription
créait un nouveau lien de confirmation au lieu de refuser la demande. Celle-ci
continuait ensuite, rencontrait une règle d’unicité dans la table des
consentements et déclenchait une annulation. Cette annulation emportait un
compte que la seconde demande n’avait jamais créé.

Nous ne savons pas combien de personnes ont été concernées. Cette phrase n’est
pas facile à écrire. Une plateforme destinée aux familles ne peut pas faire
comme s’il ne s’agissait que d’un petit problème technique.

## Certaines villes restaient dehors

Kinavela avait une limite de lancement : un nombre maximal de familles actives
et une liste de villes autorisées. Les personnes vivant à Schrobenhausen,
Aresing, Manching ou Karlskron ne pouvaient pas terminer leur inscription. Il
ne manquait rien à leur adresse ; leur ville n’avait simplement pas été ajoutée
une par une.

Cette règle devait nous permettre de démarrer prudemment. Elle a été vécue
comme un refus. Cela ne correspond pas à Kinavela. Les familles de la diaspora
ne vivent pas uniquement à Berlin ou à Munich. Elles vivent aussi dans des
villes plus petites et doivent pouvoir se rencontrer là où se déroule leur
quotidien.

La règle est désormais simple : toute personne qui sélectionne une adresse
valide en Allemagne peut s’inscrire. Le déclencheur de base de données qui
bloquait cette étape a été supprimé.

## Le curseur mentait

Pendant l’inscription, chacun choisit la distance maximale à laquelle peuvent
se trouver les autres familles. Après une interruption, le formulaire
affichait toujours « 40 km », quelle que soit la position réelle du curseur.

L’écran conservait sa valeur de départ alors qu’une autre valeur était
enregistrée en arrière-plan. On n’envoyait donc pas forcément ce que l’on avait
lu. Pour une décision aussi personnelle que la proximité avec d’autres
familles, le choix doit être visible et fiable.

## Le champ qui ne disait rien

Dans la recherche de ville, il faut taper puis sélectionner un résultat dans
la liste. Beaucoup de personnes écrivaient un lieu et continuaient. Après tout,
le champ semblait rempli.

Une phrase apparaît maintenant sous le champ : « Recherchez, puis sélectionnez
la ville dans la liste. » Nous aurions dû l’écrire dès le début.

## Pourquoi nous en parlons publiquement

Kinavela doit aider les familles à créer des liens de confiance près de chez
elles et à transmettre leurs racines culturelles à leurs enfants. Avant qu’une
rencontre puisse avoir lieu, les premières étapes doivent déjà être justes,
compréhensibles et fiables.

Je ne peux pas promettre que nous ne ferons plus jamais d’erreur. Je peux en
revanche promettre que nous ne cacherons pas nos erreurs derrière des termes
techniques. Nous expliquons ce qui n’a pas fonctionné pour les personnes, nous
le réparons et nous racontons ce que nous en avons appris.
