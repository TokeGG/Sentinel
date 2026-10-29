// Shared chat prefs for every room view in the panel (user nick/colour, filters, logging).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { emptyFilters, toFilters, type Filters, type UserPref } from "./chatExtras";
import { loadPrefs, setFilter, setUserPref } from "./extrasStore";

export interface ChatPrefs {
  users: Map<string, UserPref>; filters: Filters; filterRows: { kind: string; value: string }[];
  logs: boolean; logCap: number; players: boolean;
  setUser(key: string, p: UserPref): void; setFilter(kind: string, value: string, on: boolean): void;
}
export const PrefsCtx = createContext<ChatPrefs>({ users: new Map(), filters: emptyFilters(), filterRows: [], logs: false, logCap: 0, players: false, setUser() {}, setFilter() {} });
export const usePrefs = () => useContext(PrefsCtx);

export function useChatPrefs(logs: boolean, logCap: number, players: boolean): ChatPrefs {
  const [users, setUsers] = useState<Map<string, UserPref>>(new Map());
  const [rows, setRows] = useState<{ kind: string; value: string }[]>([]);
  const [v, setV] = useState(0);
  useEffect(() => { let live = true; loadPrefs().then((p) => { if (live) { setUsers(p.users); setRows(p.filters); } }).catch(() => {}); return () => void (live = false); }, [v]);
  const bump = useCallback(() => setV((n) => n + 1), []);
  const filters = useMemo(() => toFilters(rows), [rows]);
  return useMemo(() => ({
    users, filters, filterRows: rows, logs, logCap, players,
    setUser: (k: string, p: UserPref) => void setUserPref(k, p).then(bump),
    setFilter: (kind: string, value: string, on: boolean) => void setFilter(kind, value, on).then(bump),
  }), [users, filters, rows, logs, logCap, players, bump]);
}
