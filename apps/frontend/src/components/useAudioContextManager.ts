import { useContext } from "react";
import { AudioManagerContext, type AudioContextManager } from "./audioManagerContext";

/** Access the global player. Must be used below `<AudioManagerProvider>`. */
export const useAudioContextManager = (): AudioContextManager => {
  const context = useContext(AudioManagerContext);
  if (!context) {
    throw new Error("useAudioContextManager must be used within AudioManagerProvider");
  }
  return context;
};
