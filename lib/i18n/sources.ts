import { accountStateCopy } from "@/components/legal/account-state-copy";
import { authEmailCopy } from "@/features/auth/email-copy";
import { discoveryActivationCopies } from "@/features/discovery-activation/copy";
import { invitationCopies } from "@/features/invitations/copy";
import { missionCopy } from "@/features/missions/copy";
import { notificationEmailCopy } from "@/features/notifications/email-copy";
import { eventCoordinationCopy, playdateCopy } from "@/features/playdates/copy";
import { rootsCopy } from "@/features/roots/copy";
import { storiesCopy } from "@/features/stories/copy";
import { trustCopyParity } from "@/features/trust/copy";
import { supportCopyParity } from "@/features/villages/support-copy";
import { adminCopy, applicationDictionaries } from "./app-copy";
import { landingDictionaries } from "./dictionaries";

export const localizedCopySources = {
  accountState: accountStateCopy,
  landing: landingDictionaries,
  application: applicationDictionaries,
  admin: adminCopy,
  authEmail: authEmailCopy,
  notificationEmail: notificationEmailCopy,
  discoveryActivation: discoveryActivationCopies,
  invitations: invitationCopies,
  missions: missionCopy,
  playdates: playdateCopy,
  eventCoordination: eventCoordinationCopy,
  roots: rootsCopy,
  stories: storiesCopy,
  trust: trustCopyParity,
  villageSupport: supportCopyParity,
} as const;
