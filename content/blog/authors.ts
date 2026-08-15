import type { BlogAuthor } from "@/features/blog/types";

/**
 * The people who write here.
 *
 * Bios are first person and written by the author themselves — see
 * docs/blog-editorial-standard.md. A bio written *about* someone in the third
 * person reads as brand copy, which is precisely the register the blog exists
 * to avoid. Keep them short and concrete: where you are, who you are to this
 * community, why you are the person writing this.
 *
 * `sameAs` should list profiles that corroborate the person exists. It is what
 * lets a search engine connect the byline to a real identity, and it stays
 * empty until there is something true to put in it.
 */
export const blogAuthors = {
  admin: {
    key: "admin",
    name: "Admin",
    role: {
      de: "Admin",
      fr: "Admin",
      en: "Admin",
    },
    bio: {
      de: "Ich betreue Kinavela und schreibe aus Mainz über die Entscheidungen hinter der Plattform. Hier geht es um Familien in der Diaspora, sichere Begegnungen und kulturelle Wurzeln, die im Alltag lebendig bleiben.",
      fr: "Je m’occupe de Kinavela et j’écris depuis Mayence sur les choix qui façonnent la plateforme. Je parle ici des familles de la diaspora, de rencontres sûres et des racines culturelles qui restent vivantes au quotidien.",
      en: "I look after Kinavela and write from Mainz about the decisions shaping the platform. This blog is about diaspora families, safe connections, and cultural roots that stay alive in everyday life.",
    },
    image: null,
    sameAs: [],
  },
} as const satisfies Record<string, BlogAuthor>;

export type BlogAuthorKey = keyof typeof blogAuthors;
