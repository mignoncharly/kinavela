/**
 * Fills `{name}` placeholders in a dictionary string. Kept deliberately dumb:
 * a missing value is left as the literal placeholder rather than blanked, so a
 * broken translation is visible in review instead of quietly losing a word.
 */
export function fill(
  template: string,
  values: Record<string, string | number>,
) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
