interface Pausable {
  pause(): void;
}

const players = new Set<Pausable>();

/** Joins the set of players that pause each other. Returns a function that leaves it. */
export function joinExclusive(player: Pausable): () => void {
  players.add(player);
  return () => {
    players.delete(player);
  };
}

export function pauseOthers(player: Pausable): void {
  for (const other of players) {
    if (other !== player) other.pause();
  }
}
