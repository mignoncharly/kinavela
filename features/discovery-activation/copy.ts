import type { Locale } from "@/lib/i18n/config";

const discoveryActivationCopies = {
  de: {
    title: "Noch keine passenden Familien gefunden",
    body: "Du kannst deine Suche direkt erweitern oder Kinavela bitten, dich bei neuen passenden Familien zu informieren.",
    increaseRadius: "Radius auf {radius} km erhöhen",
    widerRegion: "Gesamte gewählte Region durchsuchen ({radius} km)",
    clearFilters: "Alle Zusatzfilter entfernen",
    villages: "Villages in deiner Nähe ansehen",
    createVillage: "Eigenes lokales Village gründen",
    inviteFamily: "Eine bekannte Familie einladen",
    broaderFound:
      "In einer breiteren Suche gibt es derzeit {count} auffindbare Familie(n).",
    nearbyVillagesTitle: "Nahe Villages",
    nearbyVillagesBody:
      "Lokale Gruppen können auch dann der schnellste Einstieg sein, wenn noch keine einzelne Familie zu deinen Filtern passt.",
    villageMembers: "{count} Familie(n)",
    clusterTitle: "Kulturelle Gemeinschaft aufbauen",
    clusterBody:
      "Kinavela hat ein anonymes lokales Signal für {country} erkannt. Es werden keine Familienidentitäten offengelegt.",
    clusterGeneric:
      "Du kannst beispielsweise „Kamerunische Familien · {city}“ oder ein anderes lokales Kultur-Village gründen.",
    alertTitle: "Bei neuen passenden Familien informieren",
    alertBody:
      "Kinavela prüft Entfernung, Sichtbarkeit, beide Radien und Blockierungen. Die Benachrichtigung nennt keine Familie; du öffnest anschließend die normale Suche.",
    alertRadius: "Benachrichtigungsradius",
    alertEnable: "Benachrichtigung aktivieren",
    alertEnabling: "Wird aktiviert …",
    alertActive: "Aktiv innerhalb von {radius} km",
    alertUpdate: "Radius aktualisieren",
    alertRevoke: "Benachrichtigung deaktivieren",
    alertRevoking: "Wird deaktiviert …",
    alertSaved:
      "Die Benachrichtigung ist aktiv. Dies ist keine Warteliste und schränkt deinen Zugang nicht ein.",
    alertRevoked: "Die Benachrichtigung wurde deaktiviert.",
    alertError: "Die Benachrichtigung konnte nicht geändert werden.",
    alertPrivacy:
      "Nur eine anonyme Trefferzahl wird benachrichtigt. E-Mail und Push werden nur mit deinen bestehenden Einwilligungen verwendet.",
    ownerOnly:
      "Nur die verantwortliche Person der Familie kann Benachrichtigungen verwalten.",
  },
  fr: {
    title: "Aucune famille compatible pour le moment",
    body: "Vous pouvez élargir immédiatement votre recherche ou demander à Kinavela de vous prévenir lorsque de nouvelles familles compatibles arrivent.",
    increaseRadius: "Augmenter le rayon à {radius} km",
    widerRegion: "Rechercher dans toute la région choisie ({radius} km)",
    clearFilters: "Supprimer tous les filtres supplémentaires",
    villages: "Voir les Villages proches",
    createVillage: "Créer mon Village local",
    inviteFamily: "Inviter une famille que je connais",
    broaderFound:
      "Une recherche élargie trouve actuellement {count} famille(s) visible(s).",
    nearbyVillagesTitle: "Villages proches",
    nearbyVillagesBody:
      "Un groupe local peut être le point de départ le plus rapide même si aucune famille ne correspond encore à vos filtres.",
    villageMembers: "{count} famille(s)",
    clusterTitle: "Créer une communauté culturelle",
    clusterBody:
      "Kinavela a détecté un signal local anonyme pour {country}. Aucune identité familiale n’est révélée.",
    clusterGeneric:
      "Vous pouvez par exemple créer « Familles camerounaises · {city} » ou un autre Village culturel local.",
    alertTitle: "Me prévenir de nouvelles familles compatibles",
    alertBody:
      "Kinavela vérifie la distance, la visibilité, les deux rayons et les blocages. La notification ne nomme aucune famille; vous ouvrez ensuite la recherche normale.",
    alertRadius: "Rayon de notification",
    alertEnable: "Activer la notification",
    alertEnabling: "Activation…",
    alertActive: "Active dans un rayon de {radius} km",
    alertUpdate: "Mettre à jour le rayon",
    alertRevoke: "Désactiver la notification",
    alertRevoking: "Désactivation…",
    alertSaved:
      "La notification est active. Ce n’est pas une liste d’attente et elle ne limite pas votre accès.",
    alertRevoked: "La notification a été désactivée.",
    alertError: "Impossible de modifier la notification.",
    alertPrivacy:
      "Seul un nombre anonyme de résultats est envoyé. L’e-mail et le push utilisent uniquement vos consentements existants.",
    ownerOnly:
      "Seule la personne responsable de la famille peut gérer les notifications.",
  },
  en: {
    title: "No compatible families found yet",
    body: "You can widen your search immediately or ask Kinavela to notify you when new compatible families become available.",
    increaseRadius: "Increase radius to {radius} km",
    widerRegion: "Search your whole selected region ({radius} km)",
    clearFilters: "Remove all additional filters",
    villages: "View nearby Villages",
    createVillage: "Create my own local Village",
    inviteFamily: "Invite a family I know",
    broaderFound:
      "A broader search currently finds {count} discoverable family/families.",
    nearbyVillagesTitle: "Nearby Villages",
    nearbyVillagesBody:
      "A local group may be the fastest starting point even when no individual family matches your filters yet.",
    villageMembers: "{count} family/families",
    clusterTitle: "Build a cultural community",
    clusterBody:
      "Kinavela found an anonymous local signal for {country}. No family identities are revealed.",
    clusterGeneric:
      "For example, you can create “Cameroonian Families · {city}” or another local cultural Village.",
    alertTitle: "Notify me about new compatible families",
    alertBody:
      "Kinavela checks distance, visibility, both radii, and blocks. The notification names no family; you then open normal discovery.",
    alertRadius: "Notification radius",
    alertEnable: "Enable notification",
    alertEnabling: "Enabling…",
    alertActive: "Active within {radius} km",
    alertUpdate: "Update radius",
    alertRevoke: "Disable notification",
    alertRevoking: "Disabling…",
    alertSaved:
      "The notification is active. This is not a waitlist and does not restrict your access.",
    alertRevoked: "The notification was disabled.",
    alertError: "The notification could not be changed.",
    alertPrivacy:
      "Only an anonymous match count is notified. Email and push use only your existing consent settings.",
    ownerOnly: "Only the family’s responsible adult can manage notifications.",
  },
} as const;

export type DiscoveryActivationCopy =
  (typeof discoveryActivationCopies)[Locale];

export const getDiscoveryActivationCopy = (locale: Locale) =>
  discoveryActivationCopies[locale];

export { discoveryActivationCopies };
