import { createContext, useContext } from "react";
import type { SyncStatus } from "../components/SyncStatusIndicator";
import type { TrackItStore } from "../types/index";

export interface StoreContextValue {
  store: TrackItStore | null;
  loading: boolean;
  error: string;
  syncStatus: SyncStatus;
  save: (updated: TrackItStore) => void;
  refresh: () => Promise<void>;
  refreshing: boolean;
}

export const StoreContext = createContext<StoreContextValue>({
  store: null,
  loading: true,
  error: "",
  syncStatus: "idle",
  save: () => {},
  refresh: async () => {},
  refreshing: false,
});

export function useStoreContext(): StoreContextValue {
  return useContext(StoreContext);
}
