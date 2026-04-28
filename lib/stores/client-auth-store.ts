import { create } from "zustand";

export type ClientSession =
  | {
      user: {
        id: string;
        name?: string | null;
        email?: string | null;
      };
    }
  | null;

type ClientAuthState = {
  session: ClientSession;
  isPending: boolean;
  setSession: (session: ClientSession) => void;
  setPending: (pending: boolean) => void;
};

export const useClientAuthStore = create<ClientAuthState>((set) => ({
  session: null,
  isPending: true,
  setSession: (session) => set({ session }),
  setPending: (pending) => set({ isPending: pending }),
}));

