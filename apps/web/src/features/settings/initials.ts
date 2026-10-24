/** Two letters for the avatar: first of the first and last words, or the first two. */
export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const [first = '', ...rest] = words;
  const last = rest.at(-1);
  const letters = last ? first[0]! + last[0]! : first.slice(0, 2);
  return letters.toLocaleUpperCase('fr');
}
