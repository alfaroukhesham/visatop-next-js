"use client";

import { createContext, useCallback, useContext, useState, type FC, type ReactNode } from "react";

interface IApplyJumpAheadValue {
  pulseContinue: boolean;
  pulse: () => void;
  clearPulse: () => void;
}

const ApplyJumpAheadContext = createContext<IApplyJumpAheadValue | null>(null);

interface IApplyJumpAheadProviderProps {
  children: ReactNode;
}

export const ApplyJumpAheadProvider: FC<IApplyJumpAheadProviderProps> = ({ children }) => {
  const [pulseContinue, setPulseContinue] = useState(false);
  const pulse = useCallback(() => {
    setPulseContinue(false);
    queueMicrotask(() => setPulseContinue(true));
  }, []);
  const clearPulse = useCallback(() => setPulseContinue(false), []);
  return (
    <ApplyJumpAheadContext.Provider value={{ pulseContinue, pulse, clearPulse }}>
      {children}
    </ApplyJumpAheadContext.Provider>
  );
};

export const useApplyJumpAhead = (): IApplyJumpAheadValue => {
  const ctx = useContext(ApplyJumpAheadContext);
  if (!ctx) {
    return {
      pulseContinue: false,
      pulse: () => undefined,
      clearPulse: () => undefined,
    };
  }
  return ctx;
};
