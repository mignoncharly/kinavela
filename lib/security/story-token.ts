import "server-only";

import { createHash } from "node:crypto";

export function hashStoryToken(token: string) {
  return createHash("sha256").update(token.trim()).digest("hex");
}
