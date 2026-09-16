import { createContext } from "react";
import type { SessionUser } from "@retrosampled/shared";

export type AuthStatus = "loading" | "authenticated" | "guest";

export type AuthModalMode = "login" | "signup";

export type AuthContextValue = {
  user: SessionUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (
    email: string,
    password: string,
    username?: string
  ) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<SessionUser | null>;
  openAuthModal: (mode?: AuthModalMode) => void;
  closeAuthModal: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
