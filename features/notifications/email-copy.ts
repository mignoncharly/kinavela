import type { Locale } from "@/lib/i18n/config";
import type { NotificationFeedItem } from "@/lib/validation/notifications";

type NotificationKind = NotificationFeedItem["notification_kind"];

type NotificationDeliveryCopy = {
  emailIntro: string;
  open: string;
  subjects: Record<NotificationKind, string>;
  bodies: Record<NotificationKind, string>;
};

export const notificationEmailCopy = {
  de: {
    emailIntro:
      "In deinem privaten Kinavela-Bereich gibt es eine neue Benachrichtigung.",
    open: "Kinavela öffnen",
    subjects: {
      connection_request: "Neue Verbindungsanfrage",
      connection_accepted: "Verbindung bestätigt",
      message_received: "Neue private Nachricht",
      event_reminder: "Erinnerung an eine Familienaktivität",
      village_activity: "Neue Village-Aktivität",
      story_ready: "Familiengeschichte bereit zur Prüfung",
      compatible_family_available: "Neue passende Familien in deiner Region",
      passport_export_ready: "Roots-Passport-Export bereit",
      referral_accepted: "Eine eingeladene Familie ist beigetreten",
      village_invitation: "Einladung in ein Village",
      village_join_request: "Neue Village-Beitrittsanfrage",
      village_join_decision: "Entscheidung zu deiner Village-Anfrage",
      event_invitation: "Neue Veranstaltung im Village",
      event_changed: "Veranstaltung aktualisiert oder abgesagt",
      event_rsvp_update: "Neue RSVP-Aktivität",
      playdate_proposal: "Privater Spieltreff-Vorschlag",
      support_response: "Neue Antwort auf deine Support-Frage",
      report_resolved: "Prüfung deiner Meldung abgeschlossen",
      story_failed: "Verarbeitung einer Familiengeschichte fehlgeschlagen",
      germany_access_opened: "Kinavela ist jetzt deutschlandweit verfügbar",
    },
    bodies: {
      connection_request: "Eine Familie möchte sich mit dir verbinden.",
      connection_accepted: "Eine Familienverbindung wurde bestätigt.",
      message_received: "Du hast eine neue private Nachricht.",
      event_reminder: "Eine Familienaktivität beginnt bald.",
      village_activity: "In deinem Village gibt es eine neue Aktivität.",
      story_ready: "Eine Familiengeschichte ist zur Prüfung bereit.",
      compatible_family_available:
        "Neue passende Familien sind in deiner Region auffindbar.",
      passport_export_ready: "Dein Roots-Passport-Export ist bereit.",
      referral_accepted:
        "Eine von dir eingeladene Familie ist Kinavela beigetreten.",
      village_invitation: "Deine Familie wurde in ein Village eingeladen.",
      village_join_request: "Für dein Village liegt eine Beitrittsanfrage vor.",
      village_join_decision: "Über deine Village-Anfrage wurde entschieden.",
      event_invitation: "In deinem Village gibt es eine neue Veranstaltung.",
      event_changed: "Eine Veranstaltung wurde aktualisiert oder abgesagt.",
      event_rsvp_update:
        "Zu einer Veranstaltung gibt es eine neue RSVP-Aktivität.",
      playdate_proposal:
        "Deine Familie hat einen privaten Spieltreff-Vorschlag erhalten.",
      support_response: "Deine Support-Frage hat eine neue Antwort.",
      report_resolved: "Die Prüfung deiner Meldung wurde abgeschlossen.",
      story_failed: "Eine Familiengeschichte konnte nicht verarbeitet werden.",
      germany_access_opened:
        "Kinavela ist jetzt in ganz Deutschland verfügbar.",
    },
  },
  fr: {
    emailIntro:
      "Une nouvelle notification vous attend dans votre espace Kinavela privé.",
    open: "Ouvrir Kinavela",
    subjects: {
      connection_request: "Nouvelle demande de connexion",
      connection_accepted: "Connexion acceptée",
      message_received: "Nouveau message privé",
      event_reminder: "Rappel d’activité familiale",
      village_activity: "Nouvelle activité du Village",
      story_ready: "Récit familial prêt à être examiné",
      compatible_family_available:
        "Nouvelles familles compatibles dans votre région",
      passport_export_ready: "Export Roots Passport prêt",
      referral_accepted: "Une famille invitée a rejoint Kinavela",
      village_invitation: "Invitation dans un Village",
      village_join_request: "Nouvelle demande d’adhésion au Village",
      village_join_decision: "Décision concernant votre demande au Village",
      event_invitation: "Nouvel événement dans le Village",
      event_changed: "Événement modifié ou annulé",
      event_rsvp_update: "Nouvelle activité RSVP",
      playdate_proposal: "Proposition de rencontre privée",
      support_response: "Nouvelle réponse à votre question d’entraide",
      report_resolved: "Examen de votre signalement terminé",
      story_failed: "Échec du traitement d’un récit familial",
      germany_access_opened: "Kinavela est disponible dans toute l’Allemagne",
    },
    bodies: {
      connection_request: "Une famille souhaite entrer en contact avec vous.",
      connection_accepted: "Votre mise en relation familiale a été acceptée.",
      message_received: "Vous avez reçu un nouveau message privé.",
      event_reminder: "Une activité familiale commence bientôt.",
      village_activity: "Il y a une nouvelle activité dans votre Village.",
      story_ready: "Une histoire familiale est prête à être vérifiée.",
      compatible_family_available:
        "De nouvelles familles compatibles sont visibles dans votre région.",
      passport_export_ready: "Votre export Roots Passport est prêt.",
      referral_accepted:
        "Une famille que vous avez invitée a rejoint Kinavela.",
      village_invitation: "Votre famille a été invitée dans un Village.",
      village_join_request: "Votre Village a reçu une demande d’adhésion.",
      village_join_decision:
        "Une décision a été prise pour votre demande au Village.",
      event_invitation: "Un nouvel événement est proposé dans votre Village.",
      event_changed: "Un événement a été modifié ou annulé.",
      event_rsvp_update: "Une activité RSVP concerne un événement.",
      playdate_proposal:
        "Votre famille a reçu une proposition privée de rencontre.",
      support_response: "Votre question d’entraide a reçu une réponse.",
      report_resolved: "L’examen de votre signalement est terminé.",
      story_failed: "Une histoire familiale n’a pas pu être traitée.",
      germany_access_opened:
        "Kinavela est maintenant disponible dans toute l’Allemagne.",
    },
  },
  en: {
    emailIntro: "A new notification is waiting in your private Kinavela space.",
    open: "Open Kinavela",
    subjects: {
      connection_request: "New connection request",
      connection_accepted: "Connection accepted",
      message_received: "New private message",
      event_reminder: "Family activity reminder",
      village_activity: "New Village activity",
      story_ready: "Family story ready for review",
      compatible_family_available: "New compatible families in your area",
      passport_export_ready: "Roots Passport export ready",
      referral_accepted: "An invited family joined Kinavela",
      village_invitation: "Village invitation",
      village_join_request: "New Village join request",
      village_join_decision: "Decision on your Village request",
      event_invitation: "New Village event",
      event_changed: "Event updated or cancelled",
      event_rsvp_update: "New RSVP activity",
      playdate_proposal: "Private playdate proposal",
      support_response: "New response to your support question",
      report_resolved: "Review of your report completed",
      story_failed: "Family story processing failed",
      germany_access_opened: "Kinavela is now available across Germany",
    },
    bodies: {
      connection_request: "A family would like to connect with you.",
      connection_accepted: "Your family connection was accepted.",
      message_received: "You have a new private message.",
      event_reminder: "A family activity is starting soon.",
      village_activity: "There is new activity in your Village.",
      story_ready: "A family story is ready for review.",
      compatible_family_available:
        "New compatible families are discoverable in your area.",
      passport_export_ready: "Your Roots Passport export is ready.",
      referral_accepted: "A family you invited has joined Kinavela.",
      village_invitation: "Your family was invited to a Village.",
      village_join_request: "Your Village has a new join request.",
      village_join_decision: "A decision was made on your Village request.",
      event_invitation: "There is a new event in your Village.",
      event_changed: "An event was updated or cancelled.",
      event_rsvp_update: "There is new RSVP activity for an event.",
      playdate_proposal: "Your family received a private playdate proposal.",
      support_response: "Your support question has a new response.",
      report_resolved: "The review of your report is complete.",
      story_failed: "A family story could not be processed.",
      germany_access_opened: "Kinavela is now available across Germany.",
    },
  },
} satisfies Record<Locale, NotificationDeliveryCopy>;

export function getNotificationDeliveryCopy(locale: string) {
  const selected =
    locale === "de" || locale === "fr" || locale === "en" ? locale : "en";
  return notificationEmailCopy[selected];
}
