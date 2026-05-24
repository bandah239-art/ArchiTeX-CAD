import { create } from 'zustand';
import { tier2API, tier3API } from '../services/boqAPI';
import { collaborationClient, type CollabMessage } from '../services/collaborationWS';

const PROJECT_ID = 'default-project';

function getUserId(): string {
  if (typeof localStorage === 'undefined') return `user-${crypto.randomUUID()}`;
  let id = localStorage.getItem('infra_user_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('infra_user_id', id);
  }
  return `user-${id}`;
}

const USER_ID = getUserId();

interface IntelligenceState {
  portfolio: Record<string, unknown> | null;
  collabStatus: Record<string, unknown> | null;
  wsConnected: boolean;
  liveEvents: Record<string, unknown>[];
  isLoading: boolean;
  error: string | null;
  loadPortfolio: () => Promise<void>;
  loadCollab: () => Promise<void>;
  joinCollab: () => Promise<void>;
  connectLiveCollab: () => void;
  disconnectLiveCollab: () => void;
  seedTwin: () => Promise<void>;
}

let unsubCollab: (() => void) | null = null;

export const useIntelligenceStore = create<IntelligenceState>((set, get) => ({
  portfolio: null,
  collabStatus: null,
  wsConnected: false,
  liveEvents: [],
  isLoading: false,
  error: null,

  loadPortfolio: async () => {
    set({ isLoading: true, error: null });
    try {
      const portfolio = await tier3API.analysePortfolio();
      set({ portfolio, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load', isLoading: false });
    }
  },

  loadCollab: async () => {
    try {
      const collabStatus = await tier2API.collabStatus(PROJECT_ID);
      set({ collabStatus });
    } catch {
      set({ collabStatus: null });
    }
  },

  connectLiveCollab: () => {
    if (unsubCollab) return;
    collaborationClient.connect(PROJECT_ID, USER_ID, 'Engineer');
    unsubCollab = collaborationClient.onMessage((msg: CollabMessage) => {
      if (msg.type === 'room_state') {
        set({ collabStatus: msg.data, wsConnected: true });
      }
      if (msg.type === 'event') {
        set((s) => ({
          wsConnected: true,
          liveEvents: [...s.liveEvents, msg.data].slice(-20),
        }));
      }
    });
    set({ wsConnected: true });
  },

  disconnectLiveCollab: () => {
    unsubCollab?.();
    unsubCollab = null;
    collaborationClient.disconnect();
    set({ wsConnected: false });
  },

  joinCollab: async () => {
    await tier2API.collabJoin(PROJECT_ID, { user_id: USER_ID, user_name: 'Engineer' });
    get().connectLiveCollab();
    await get().loadCollab();
  },

  seedTwin: async () => {
    await tier3API.seedTwin();
    await get().loadPortfolio();
  },
}));

export { collaborationClient };
