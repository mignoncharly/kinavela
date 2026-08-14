/**
 * Small illustrated vignettes for the four journey cards.
 *
 * Built from the same flat-shape vocabulary as the hero's community scene in
 * globals.css — same figure silhouettes, same palette, same rooftop and
 * foliage shapes — so the illustration reads as one world rather than as
 * decoration bolted onto a card. Pure CSS shapes: no images to ship, nothing
 * to load, and they inherit the page's colour tokens.
 *
 * Purely decorative. The card already carries its meaning in the heading and
 * body copy, so the whole thing is hidden from assistive technology.
 */
export function JourneyScene({ index }: { index: number }) {
  return (
    <span className="vig" aria-hidden="true">
      {index === 0 ? (
        // Discover: two families a distance apart, the gap between them marked.
        <>
          <span className="vig-ground" />
          <span className="vig-person vig-skin-1 vig-far-left" />
          <span className="vig-person vig-skin-3 vig-far-right" />
          <span className="vig-span" />
        </>
      ) : index === 1 ? (
        // Connect: two adults turned toward each other, arms reaching.
        <>
          <span className="vig-ground" />
          <span className="vig-person vig-skin-2 vig-face-left vig-reach" />
          <span className="vig-person vig-skin-4 vig-face-right vig-reach" />
          <span className="vig-spark vig-spark-mid" />
        </>
      ) : index === 2 ? (
        // Village: a cluster of homes with a tree, the neighbourhood forming.
        <>
          <span className="vig-ground" />
          <span className="vig-tree" />
          <span className="vig-home vig-home-a" />
          <span className="vig-home vig-home-b" />
          <span className="vig-home vig-home-c" />
        </>
      ) : (
        // Memories: an adult and a child side by side, a story passing between.
        <>
          <span className="vig-ground" />
          <span className="vig-person vig-skin-2 vig-adult" />
          <span className="vig-person vig-skin-3 vig-child" />
          <span className="vig-spark vig-spark-high" />
          <span className="vig-spark vig-spark-low" />
        </>
      )}
    </span>
  );
}
