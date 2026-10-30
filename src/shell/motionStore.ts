// Tiny module-level store shared by GameHud (writer) and StarMap (reader).
type Motion = { gameMode: boolean; starMotion: boolean; orbitMotion: boolean; orbitSpeed: number; notifMoons: boolean; ignoreReduced: boolean; lowPower: boolean };
let state: Motion = { gameMode: false, starMotion: true, orbitMotion: true, orbitSpeed: 1, notifMoons: true, ignoreReduced: true, lowPower: false };
const subs = new Set<() => void>();

export const getMotion = (): Motion => state;
export function subscribeMotion(f: () => void): () => void {
  subs.add(f);
  return () => void subs.delete(f);
}
function patch(p: Partial<Motion>) {
  const next = { ...state, ...p };
  if ((Object.keys(next) as (keyof Motion)[]).every((k) => next[k] === state[k])) return;
  state = next;
  subs.forEach((f) => f());
}
export const setGameMode = (gameMode: boolean) => patch({ gameMode });
export const setStarMotion = (starMotion: boolean) => patch({ starMotion });
export const setOrbitMotion = (orbitMotion: boolean) => patch({ orbitMotion });
export const setOrbitSpeed = (orbitSpeed: number) => patch({ orbitSpeed });
export const setIgnoreReduced = (ignoreReduced: boolean) => patch({ ignoreReduced });
export const setLowPower = (lowPower: boolean) => patch({ lowPower });
export const setNotifMoons = (notifMoons: boolean) => patch({ notifMoons });
/** The loop runs if either layer may move; each frame advances only enabled layers. */
export const anyMotion = (m: Motion = state) => m.starMotion || m.orbitMotion;
