import type { Locale } from "@/lib/i18n/config";

const copy = {
  de: {
    title: "Vertrauen und Verifizierung",
    intro:
      "Verifizierung bestätigt nur den jeweils genannten Schritt. Sie bedeutet nicht, dass Kinavela eine Person als sicher einstuft.",
    email: "E-Mail bestätigt",
    emailDetail:
      "Supabase Auth hat die Kontrolle über die E-Mail-Adresse bestätigt.",
    phone: "Telefon optional bestätigen",
    phoneDetail:
      "Bestätigt nur die Kontrolle über diese Telefonnummer. Deine Nummer wird anderen Familien nicht angezeigt.",
    community: "Community-Verifizierung",
    communityDetail:
      "Eine etablierte, bereits community-verifizierte Village-Moderation oder Kinavela-Mitarbeitende können deine Anfrage prüfen.",
    verified: "Bestätigt",
    notVerified: "Nicht bestätigt",
    phonePlaceholder: "+49…",
    sendPhoneCode: "SMS-Code senden",
    sending: "Wird gesendet…",
    phoneCode: "Bestätigungscode",
    verifyPhone: "Telefon bestätigen",
    phoneSent: "Der Code wurde gesendet.",
    phoneVerified: "Die Telefonnummer wurde bestätigt.",
    phoneError:
      "Die Telefonbestätigung ist derzeit nicht verfügbar oder die Eingabe ist ungültig.",
    chooseVillage: "Village für die Prüfung",
    requestCommunity: "Prüfung anfragen",
    requestPending: "Deine Community-Prüfung ist offen.",
    requestComplete: "Deine Community-Verifizierung wurde abgeschlossen.",
    requestError: "Die Community-Prüfung konnte nicht angefragt werden.",
    noVillage:
      "Tritt zuerst einem Village bei, damit eine Community-Prüfung einen echten lokalen Kontext hat.",
    exactStatement: "Was geprüft wurde",
    communityStaffStatement:
      "Kinavela-Mitarbeitende haben den Antrag auf Community-Verifizierung dieses Erwachsenenprofils geprüft und genehmigt.",
    communityModeratorStatement:
      "Eine etablierte, bereits community-verifizierte Village-Moderation hat dieses Erwachsenenprofil im Village-Kontext bestätigt.",
    safetyTitle: "Vor dem ersten Treffen",
    safetyIntro:
      "Bitte bestätige diese Hinweise einmal, bevor du erstmals verbindlich zusagst oder ein persönliches Treffen einträgst.",
    safetyItems: [
      "Trefft euch anfangs an einem öffentlichen Ort.",
      "Teile keine Schul- oder direkten Kontaktdaten eines Kindes.",
      "Sorgeberechtigte bleiben für die Aufsicht verantwortlich.",
      "Kontrolliere, wann eine genaue Adresse sichtbar wird.",
      "Nutze Blockieren und Melden, wenn dir etwas unangenehm ist.",
      "Kontaktiere bei unmittelbarer Gefahr den Notruf.",
    ],
    safetyAcknowledge: "Ich habe die Hinweise gelesen und verstanden.",
    safetyContinue: "Bestätigen und fortfahren",
    safetyRecorded: "Sicherheitshinweise bestätigt",
    endorse: "Community-Verifizierung bestätigen",
    endorseBusy: "Wird bestätigt…",
    endorsementExact:
      "Damit bestätigst du nur, dass du dieses erwachsene Profil im Village-Kontext geprüft hast – nicht, dass die Person garantiert sicher ist.",
  },
  fr: {
    title: "Confiance et vérification",
    intro:
      "Chaque vérification confirme uniquement l’étape indiquée. Elle ne signifie pas que Kinavela déclare une personne sûre.",
    email: "E-mail confirmé",
    emailDetail: "Supabase Auth a confirmé le contrôle de l’adresse e-mail.",
    phone: "Confirmer le téléphone (facultatif)",
    phoneDetail:
      "Confirme uniquement le contrôle de ce numéro. Il n’est pas affiché aux autres familles.",
    community: "Vérification communautaire",
    communityDetail:
      "Une modération de Village établie et déjà vérifiée par la communauté, ou l’équipe Kinavela, peut examiner votre demande.",
    verified: "Confirmé",
    notVerified: "Non confirmé",
    phonePlaceholder: "+49…",
    sendPhoneCode: "Envoyer le code SMS",
    sending: "Envoi…",
    phoneCode: "Code de confirmation",
    verifyPhone: "Confirmer le téléphone",
    phoneSent: "Le code a été envoyé.",
    phoneVerified: "Le numéro de téléphone a été confirmé.",
    phoneError:
      "La confirmation téléphonique est indisponible ou les données sont invalides.",
    chooseVillage: "Village chargé de l’examen",
    requestCommunity: "Demander un examen",
    requestPending: "Votre examen communautaire est en attente.",
    requestComplete: "Votre vérification communautaire est terminée.",
    requestError: "La demande d’examen n’a pas pu être créée.",
    noVillage:
      "Rejoignez d’abord un Village afin que l’examen ait un véritable contexte local.",
    exactStatement: "Ce qui a été vérifié",
    communityStaffStatement:
      "L’équipe Kinavela a examiné et approuvé la demande de vérification communautaire de ce profil adulte.",
    communityModeratorStatement:
      "Une modération de Village établie et déjà vérifiée par la communauté a confirmé ce profil adulte dans le contexte du Village.",
    safetyTitle: "Avant la première rencontre",
    safetyIntro:
      "Confirmez ces conseils une seule fois avant votre première réponse ferme ou confirmation de rencontre.",
    safetyItems: [
      "Rencontrez-vous d’abord dans un lieu public.",
      "Ne partagez ni l’école ni les coordonnées directes d’un enfant.",
      "Les responsables légaux restent responsables de la surveillance.",
      "Contrôlez quand une adresse exacte devient visible.",
      "Utilisez le blocage et le signalement si vous êtes mal à l’aise.",
      "En cas de danger immédiat, contactez les services d’urgence.",
    ],
    safetyAcknowledge: "J’ai lu et compris ces conseils.",
    safetyContinue: "Confirmer et continuer",
    safetyRecorded: "Conseils de sécurité confirmés",
    endorse: "Confirmer la vérification communautaire",
    endorseBusy: "Confirmation…",
    endorsementExact:
      "Vous confirmez uniquement avoir examiné ce profil adulte dans le contexte du Village, sans garantir que cette personne est sûre.",
  },
  en: {
    title: "Trust and verification",
    intro:
      "Each verification confirms only the stated step. It does not mean Kinavela has declared a person safe.",
    email: "Email confirmed",
    emailDetail: "Supabase Auth confirmed control of the email address.",
    phone: "Optional phone confirmation",
    phoneDetail:
      "Confirms only control of this phone number. The number is not shown to other families.",
    community: "Community verification",
    communityDetail:
      "An established, already community-verified Village moderator or Kinavela staff can review your request.",
    verified: "Confirmed",
    notVerified: "Not confirmed",
    phonePlaceholder: "+49…",
    sendPhoneCode: "Send SMS code",
    sending: "Sending…",
    phoneCode: "Confirmation code",
    verifyPhone: "Confirm phone",
    phoneSent: "The code was sent.",
    phoneVerified: "The phone number was confirmed.",
    phoneError:
      "Phone confirmation is unavailable right now or the input is invalid.",
    chooseVillage: "Village for review",
    requestCommunity: "Request review",
    requestPending: "Your community review is pending.",
    requestComplete: "Your community verification is complete.",
    requestError: "The community review could not be requested.",
    noVillage:
      "Join a Village first so community review has a real local context.",
    exactStatement: "What was verified",
    communityStaffStatement:
      "Kinavela staff reviewed and approved this adult profile’s community verification request.",
    communityModeratorStatement:
      "An established, already community-verified Village moderator endorsed this adult profile in the Village context.",
    safetyTitle: "Before the first meeting",
    safetyIntro:
      "Confirm this guidance once before your first firm RSVP or in-person meeting confirmation.",
    safetyItems: [
      "Meet in a public place initially.",
      "Do not share a child’s school or direct contact details.",
      "Guardians remain responsible for supervision.",
      "Control when an exact address becomes visible.",
      "Use block and report if you feel uncomfortable.",
      "Contact emergency services for immediate danger.",
    ],
    safetyAcknowledge: "I have read and understood this guidance.",
    safetyContinue: "Confirm and continue",
    safetyRecorded: "Safety guidance confirmed",
    endorse: "Confirm community verification",
    endorseBusy: "Confirming…",
    endorsementExact:
      "You confirm only that you reviewed this adult profile in the Village context—not that the person is guaranteed safe.",
  },
} as const;

export const getTrustCopy = (locale: Locale) => copy[locale];

export const trustCopyParity = copy;
