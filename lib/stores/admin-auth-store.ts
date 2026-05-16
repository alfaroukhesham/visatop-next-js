import { create } from "zustand";

export type AdminSession =
  | {
      user: {
        id: string;
        name?: string | null;
        email?: string | null;
      };
    }
  | null;

type AdminAuthState = {
  session: AdminSession;
  isPending: boolean;
  setSession: (session: AdminSession) => void;
  setPending: (pending: boolean) => void;
};

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  session: null,
  isPending: true,
  setSession: (session) => set({ session }),
  setPending: (pending) => set({ isPending: pending }),
}));
