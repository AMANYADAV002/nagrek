/** Stable pair key so both people read and write the same chat thread. */
export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
