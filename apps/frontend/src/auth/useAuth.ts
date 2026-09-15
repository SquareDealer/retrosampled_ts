import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "./authContext";

/** Access the session. Must be used below `<AuthProvider>` (wired in `main.tsx`). */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }

  return context;
}
