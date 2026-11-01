/**
 * Lets only the newest of overlapping requests apply its result. `begin()` returns a ticket for a new request;
 * `isLatest(ticket)` is true only while no newer request has begun. An older response that arrives later is dropped, so a
 * list never falls back to a state the server has since changed (Block 103: the administrator job queue).
 */
export function latestRequestGate() {
  let current = 0;
  return { begin: () => ++current, isLatest: (ticket: number) => ticket === current };
}
