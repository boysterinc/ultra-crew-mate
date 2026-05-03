// AutoLap core state machine (Step 4).
// Pure logic only — no RSSI, no Bluetooth, no race-store wiring yet.
//
// States:
//   - "ready"          : athlete is outside checkpoint zone, a new lap can be triggered
//   - "in-checkpoint"  : athlete is currently inside the checkpoint zone, new laps blocked
//
// Rules implemented here:
//   1. lapTrigger() → if Ready, transition to In-Checkpoint and emit a lap event.
//   2. While In-Checkpoint, lapTrigger() is ignored (blocked).
//   3. Reset to Ready ONLY when the signal has been gone (signalLost) for >= 30s.
//      Any signalSeen() call cancels the pending reset.
//
// The machine is per-athlete. Use createAutoLapMachine() per device/athlete.
import { create } from "zustand";

export type AutoLapState = "ready" | "in-checkpoint";

export const SIGNAL_LOST_RESET_MS = 30_000;

export interface AutoLapMachine {
  /** Current state. */
  getState: () => AutoLapState;
  /** Timestamp (ms) of the last accepted lap, or null. */
  getLastLapAt: () => number | null;
  /**
   * Attempt to register a lap.
   * Returns true if accepted (state was "ready"), false if blocked.
   */
  lapTrigger: (now?: number) => boolean;
  /** Mark that a signal is currently visible — cancels any pending reset. */
  signalSeen: (now?: number) => void;
  /** Mark that the signal is gone — starts the 30s reset countdown if In-Checkpoint. */
  signalLost: (now?: number) => void;
  /** Force back to "ready" (manual override / tests). */
  reset: () => void;
  /** Subscribe to state changes. Returns an unsubscribe fn. */
  subscribe: (listener: (state: AutoLapState) => void) => () => void;
}

export const createAutoLapMachine = (): AutoLapMachine => {
  let state: AutoLapState = "ready";
  let lastLapAt: number | null = null;
  let lostSince: number | null = null;
  let resetTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<(state: AutoLapState) => void>();

  const setState = (next: AutoLapState) => {
    if (state === next) return;
    state = next;
    listeners.forEach((l) => l(state));
  };

  const clearTimer = () => {
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
  };

  const scheduleReset = (delay: number) => {
    clearTimer();
    resetTimer = setTimeout(() => {
      // Only reset if still in-checkpoint and signal still considered lost.
      if (state === "in-checkpoint" && lostSince !== null) {
        setState("ready");
        lostSince = null;
      }
      resetTimer = null;
    }, Math.max(0, delay));
  };

  return {
    getState: () => state,
    getLastLapAt: () => lastLapAt,

    lapTrigger: (now = Date.now()) => {
      if (state !== "ready") return false; // Rule 2: block new laps while in-checkpoint
      lastLapAt = now;
      setState("in-checkpoint"); // Rule 1
      // Entering the zone implies signal is present.
      lostSince = null;
      clearTimer();
      return true;
    },

    signalSeen: (_now = Date.now()) => {
      // Cancel any pending reset; we still see the device.
      lostSince = null;
      clearTimer();
    },

    signalLost: (now = Date.now()) => {
      // Rule 3: only relevant when In-Checkpoint.
      if (state !== "in-checkpoint") return;
      if (lostSince !== null) return; // already counting
      lostSince = now;
      scheduleReset(SIGNAL_LOST_RESET_MS);
    },

    reset: () => {
      clearTimer();
      lostSince = null;
      setState("ready");
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

// ---------------------------------------------------------------------------
// Optional Zustand registry: keeps one machine per athleteId.
// UI can read summary state without owning the machine instances.
// ---------------------------------------------------------------------------
interface AutoLapRegistryState {
  /** athleteId → current AutoLapState (mirror for reactive UI). */
  states: Record<string, AutoLapState>;
  /** athleteId → last lap timestamp. */
  lastLapAt: Record<string, number | null>;
  /** Internal: the actual machine instances (not reactive). */
  _machines: Record<string, AutoLapMachine>;
  getMachine: (athleteId: string) => AutoLapMachine;
  removeMachine: (athleteId: string) => void;
}

export const useAutoLapRegistry = create<AutoLapRegistryState>((set, get) => ({
  states: {},
  lastLapAt: {},
  _machines: {},
  getMachine: (athleteId) => {
    const existing = get()._machines[athleteId];
    if (existing) return existing;
    const machine = createAutoLapMachine();
    machine.subscribe((s) => {
      set((cur) => ({
        states: { ...cur.states, [athleteId]: s },
        lastLapAt: { ...cur.lastLapAt, [athleteId]: machine.getLastLapAt() },
      }));
    });
    set((cur) => ({
      _machines: { ...cur._machines, [athleteId]: machine },
      states: { ...cur.states, [athleteId]: machine.getState() },
      lastLapAt: { ...cur.lastLapAt, [athleteId]: null },
    }));
    return machine;
  },
  removeMachine: (athleteId) => {
    set((cur) => {
      const { [athleteId]: _m, ..._machines } = cur._machines;
      const { [athleteId]: _s, ...states } = cur.states;
      const { [athleteId]: _l, ...lastLapAt } = cur.lastLapAt;
      return { _machines, states, lastLapAt };
    });
  },
}));
