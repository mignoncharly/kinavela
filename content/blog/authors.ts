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
  charles: {
    key: "charles",
    name: "Nguenkam Charles",
    role: {
      de: "Gründer von Kinavela",
      fr: "Fondateur de Kinavela",
      en: "Founder of Kinavela",
    },
    bio: {
      de: "Ich bin Charles, Vater, in Kamerun geboren und heute in Mainz zu Hause. Ich baue Kinavela, damit Familien in der Diaspora einander in ihrer Nähe finden und ihre kulturellen Wurzeln mit ihren Kindern lebendig halten.",
      fr: "Je suis Charles, père, né au Cameroun et aujourd’hui chez moi à Mayence. Je construis Kinavela pour que les familles de la diaspora puissent se rencontrer près de chez elles et faire vivre leurs racines culturelles avec leurs enfants.",
      en: "I’m Charles, a father, born in Cameroon and now at home in Mainz. I’m building Kinavela so diaspora families can find each other nearby and keep their cultural roots alive with their children.",
    },
    image: null,
    sameAs: [],
  },
} as const satisfies Record<string, BlogAuthor>;

export type BlogAuthorKey = keyof typeof blogAuthors;
