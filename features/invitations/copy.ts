import type { Locale } from "@/lib/i18n/config";

const invitationCopies = {
  de: {
    eyebrow: "Sicher einladen",
    generalTitle: "Eine Familie zu Kinavela einladen",
    generalBody:
      "Teile einen privaten Empfehlungslink. Der Link enthält weder deinen Namen noch Familiendaten.",
    villageTitle: "Familien von außerhalb einladen",
    villageBody:
      "Der öffentliche Link zeigt nur den Namen und die Region des Village. Die Familie muss sich registrieren und die Einladung ausdrücklich annehmen.",
    eventTitle: "Zum Event und Village einladen",
    eventBody:
      "Der Link zeigt nur Eventtitel, Zeitpunkt und die öffentliche Village-Region. Die genaue Adresse bleibt geschützt.",
    create: "Einladungslink erstellen",
    creating: "Link wird erstellt …",
    expires: "Gültig bis {date}",
    privacy:
      "Keine Kinder-, Kontakt- oder exakten Standortdaten werden geteilt.",
    whatsapp: "Über WhatsApp teilen",
    nativeShare: "Teilen",
    copyLink: "Link kopieren",
    email: "Per E-Mail",
    copied: "Link kopiert.",
    shareFailed:
      "Der Link konnte auf diesem Gerät nicht geteilt werden. Bitte versuche es erneut.",
    revoke: "Link widerrufen",
    revoking: "Wird widerrufen …",
    actionError: "Das hat nicht geklappt. Bitte versuche es erneut.",
    referralShare:
      "Ich lade dich zu Kinavela ein – einem sicheren Netzwerk für Familien, Begegnungen und kulturelle Wurzeln.",
    villageShare: "Einladung zu {village} auf Kinavela.",
    eventShare: "Einladung zu {event} über Kinavela.",
    internalEventShare: "Event mit Village-Mitgliedern teilen",
    internalEventBody:
      "Dieser interne Link funktioniert nur für bereits berechtigte Village-Mitglieder.",
    publicEyebrow: "Private Familieneinladung",
    referralPublicTitle: "Du wurdest zu Kinavela eingeladen",
    referralPublicBody:
      "Entdecke Familien in deiner Region, baue vertrauensvolle Verbindungen auf und pflege kulturelle Wurzeln.",
    villagePublicTitle: "Einladung zu {village}",
    villagePublicBody:
      "Registriere deine Familie oder melde dich an. Danach kannst du diese Einladung ausdrücklich annehmen.",
    areaLabel: "Region",
    eventLabel: "Gemeinsames Event",
    expiresLabel: "Einladung gültig bis",
    signup: "Familie registrieren",
    signIn: "Anmelden",
    continueOnboarding: "Familienprofil fertigstellen",
    accept: "Einladung annehmen",
    accepting: "Einladung wird geprüft …",
    acceptConsent:
      "Mit der Annahme möchtest du diesem Village beitreten. Kinavela prüft Entfernung, Kapazität und Sicherheitsregeln.",
    continueApp: "Zu Kinavela",
    invalidTitle: "Diese Einladung ist nicht verfügbar",
    invalidBody:
      "Der Link ist ungültig, abgelaufen oder wurde widerrufen. Bitte die einladende Person um einen neuen Link.",
    geoError: "Deine Familie liegt außerhalb des Village-Radius.",
    fullError: "Dieses Village hat derzeit keine freien Plätze.",
    ownerError: "Nur die verantwortliche Person deiner Familie kann beitreten.",
    membershipError: "Deine Familie ist bereits Mitglied dieses Village.",
    unavailableError: "Diese Einladung ist nicht mehr verfügbar.",
  },
  fr: {
    eyebrow: "Inviter en sécurité",
    generalTitle: "Inviter une famille sur Kinavela",
    generalBody:
      "Partagez un lien de recommandation privé. Le lien ne contient ni votre nom ni les données de votre famille.",
    villageTitle: "Inviter des familles extérieures",
    villageBody:
      "Le lien public affiche uniquement le nom et la région du Village. La famille doit s’inscrire et accepter explicitement l’invitation.",
    eventTitle: "Inviter à l’événement et au Village",
    eventBody:
      "Le lien affiche uniquement le titre, l’horaire et la région publique du Village. L’adresse exacte reste protégée.",
    create: "Créer un lien d’invitation",
    creating: "Création du lien…",
    expires: "Valable jusqu’au {date}",
    privacy:
      "Aucune donnée d’enfant, de contact ou de localisation exacte n’est partagée.",
    whatsapp: "Partager sur WhatsApp",
    nativeShare: "Partager",
    copyLink: "Copier le lien",
    email: "Par e-mail",
    copied: "Lien copié.",
    shareFailed:
      "Le lien n’a pas pu être partagé sur cet appareil. Veuillez réessayer.",
    revoke: "Révoquer le lien",
    revoking: "Révocation…",
    actionError: "Une erreur est survenue. Veuillez réessayer.",
    referralShare:
      "Je vous invite sur Kinavela, un réseau sûr pour les familles, les rencontres et les racines culturelles.",
    villageShare: "Invitation à rejoindre {village} sur Kinavela.",
    eventShare: "Invitation à {event} via Kinavela.",
    internalEventShare: "Partager avec les membres du Village",
    internalEventBody:
      "Ce lien interne fonctionne uniquement pour les membres autorisés du Village.",
    publicEyebrow: "Invitation familiale privée",
    referralPublicTitle: "Vous êtes invité sur Kinavela",
    referralPublicBody:
      "Découvrez des familles de votre région, créez des liens de confiance et transmettez vos racines culturelles.",
    villagePublicTitle: "Invitation à rejoindre {village}",
    villagePublicBody:
      "Inscrivez votre famille ou connectez-vous. Vous pourrez ensuite accepter explicitement cette invitation.",
    areaLabel: "Région",
    eventLabel: "Événement commun",
    expiresLabel: "Invitation valable jusqu’au",
    signup: "Inscrire ma famille",
    signIn: "Se connecter",
    continueOnboarding: "Terminer le profil familial",
    accept: "Accepter l’invitation",
    accepting: "Vérification de l’invitation…",
    acceptConsent:
      "En acceptant, vous demandez à rejoindre ce Village. Kinavela vérifie la distance, la capacité et les règles de sécurité.",
    continueApp: "Accéder à Kinavela",
    invalidTitle: "Cette invitation n’est pas disponible",
    invalidBody:
      "Le lien est invalide, expiré ou révoqué. Demandez un nouveau lien à la personne qui vous a invité.",
    geoError: "Votre famille se trouve hors du rayon de ce Village.",
    fullError: "Ce Village n’a actuellement plus de place.",
    ownerError:
      "Seule la personne responsable de votre famille peut la faire rejoindre.",
    membershipError: "Votre famille est déjà membre de ce Village.",
    unavailableError: "Cette invitation n’est plus disponible.",
  },
  en: {
    eyebrow: "Invite safely",
    generalTitle: "Invite a family to Kinavela",
    generalBody:
      "Share a private referral link. The link contains neither your name nor your family data.",
    villageTitle: "Invite families from outside",
    villageBody:
      "The public link shows only the Village name and area. The family must register and explicitly accept the invitation.",
    eventTitle: "Invite to the event and Village",
    eventBody:
      "The link shows only the event title, time, and public Village area. The exact address stays protected.",
    create: "Create invitation link",
    creating: "Creating link…",
    expires: "Valid until {date}",
    privacy: "No child, contact, or exact-location data is shared.",
    whatsapp: "Share on WhatsApp",
    nativeShare: "Share",
    copyLink: "Copy link",
    email: "By email",
    copied: "Link copied.",
    shareFailed:
      "The link could not be shared on this device. Please try again.",
    revoke: "Revoke link",
    revoking: "Revoking…",
    actionError: "That did not work. Please try again.",
    referralShare:
      "I’m inviting you to Kinavela, a safe network for families, real-life connections, and cultural roots.",
    villageShare: "An invitation to join {village} on Kinavela.",
    eventShare: "An invitation to {event} through Kinavela.",
    internalEventShare: "Share with Village members",
    internalEventBody:
      "This internal link works only for existing authorized Village members.",
    publicEyebrow: "Private family invitation",
    referralPublicTitle: "You have been invited to Kinavela",
    referralPublicBody:
      "Discover families in your area, build trusted connections, and nurture cultural roots.",
    villagePublicTitle: "Invitation to join {village}",
    villagePublicBody:
      "Register your family or sign in. You can then explicitly accept this invitation.",
    areaLabel: "Area",
    eventLabel: "Shared event",
    expiresLabel: "Invitation valid until",
    signup: "Register my family",
    signIn: "Sign in",
    continueOnboarding: "Finish family profile",
    accept: "Accept invitation",
    accepting: "Checking invitation…",
    acceptConsent:
      "By accepting, you ask to join this Village. Kinavela checks distance, capacity, and safety rules.",
    continueApp: "Go to Kinavela",
    invalidTitle: "This invitation is not available",
    invalidBody:
      "The link is invalid, expired, or revoked. Ask the person who invited you for a new link.",
    geoError: "Your family is outside this Village’s radius.",
    fullError: "This Village currently has no available places.",
    ownerError: "Only your family’s responsible adult can join.",
    membershipError: "Your family is already a member of this Village.",
    unavailableError: "This invitation is no longer available.",
  },
} as const;

export type InvitationCopy = (typeof invitationCopies)[Locale];

export function getInvitationCopy(locale: Locale): InvitationCopy {
  return invitationCopies[locale];
}

export { invitationCopies };
