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
    // Replace with your own words before the first post ships. These sentences
    // are factual but they are not yours, and the whole point of a byline is
    // that it is. Delete `placeholderBio` once you have rewritten them — the
    // voice check reports it until you do.
    bio: {
      de: "Ich baue Kinavela von Mainz aus. Ich bin Vater und kamerunischer Einwanderer in Deutschland.",
      fr: "Je construis Kinavela depuis Mayence. Je suis père et immigré camerounais en Allemagne.",
      en: "I build Kinavela from Mainz. I am a father and a Cameroonian immigrant in Germany.",
    },
    image: null,
    sameAs: [],
    placeholderBio: true,
  },
} as const satisfies Record<string, BlogAuthor>;

export type BlogAuthorKey = keyof typeof blogAuthors;
