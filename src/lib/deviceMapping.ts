// Step 2: Athlete ↔ Device name mapping store.
// Persisted in localStorage. No Bluetooth wiring yet.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface DeviceMapping {
  athlete_id: string;
  athlete_name: string;
  device_name: string;
}

interface DeviceMappingState {
  mappings: DeviceMapping[];
  setMapping: (athleteId: string, athleteName: string, deviceName: string) => void;
  removeMapping: (athleteId: string) => void;
  getMapping: (athleteId: string) => DeviceMapping | undefined;
}

export const useDeviceMappingStore = create<DeviceMappingState>()(
  persist(
    (set, get) => ({
      mappings: [],
      setMapping: (athleteId, athleteName, deviceName) => {
        const trimmed = deviceName.trim();
        if (!athleteId || !trimmed) return;
        set((s) => {
          const others = s.mappings.filter((m) => m.athlete_id !== athleteId);
          return {
            mappings: [
              ...others,
              { athlete_id: athleteId, athlete_name: athleteName, device_name: trimmed },
            ],
          };
        });
      },
      removeMapping: (athleteId) =>
        set((s) => ({ mappings: s.mappings.filter((m) => m.athlete_id !== athleteId) })),
      getMapping: (athleteId) => get().mappings.find((m) => m.athlete_id === athleteId),
    }),
    {
      name: "autoLapDeviceMappings",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
