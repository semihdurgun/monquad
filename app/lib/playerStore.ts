export type PerGameData = Record<string, unknown>;

export interface PlayerData {
  playerId: string;
  totals: Record<string, unknown>;
  perGame: Record<string, PerGameData>;
}

// Simple in-memory store (demo). In production, replace with DB calls.
const players = new Map<string, PlayerData>();

// Seed example (optional)
function ensurePlayer(playerId: string): PlayerData {
  if (!players.has(playerId)) {
    players.set(playerId, {
      playerId,
      totals: { score: 0, gamesPlayed: 0 },
      perGame: {},
    });
  }
  return players.get(playerId)!;
}

export function getPlayerData(playerId: string): PlayerData {
  return ensurePlayer(playerId);
}

export function getPlayerDataPerGame(playerId: string, gameId: string): PerGameData {
  const player = ensurePlayer(playerId);
  if (!player.perGame[gameId]) {
    player.perGame[gameId] = {};
  }
  return player.perGame[gameId];
}

export function updatePlayerData(params: {
  playerId: string;
  gameId?: string;
  data: Record<string, unknown>;
}): PlayerData {
  const { playerId, gameId, data } = params;
  const player = ensurePlayer(playerId);

  if (gameId) {
    const current = (player.perGame[gameId] ?? {}) as Record<string, unknown>;
    player.perGame[gameId] = { ...current, ...data };
  } else {
    // Merge numbers for totals if provided; otherwise overwrite
    for (const [key, value] of Object.entries(data)) {
      const current = player.totals[key];
      if (typeof value === 'number' && typeof current === 'number') {
        player.totals[key] = current + value;
      } else {
        player.totals[key] = value;
      }
    }
  }

  return player;
} 