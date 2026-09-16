import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { SessionUser } from "@retrosampled/shared";
import * as authApi from "../api/auth";
import { AUTH_EXPIRED_EVENT } from "../api/http";
import { AuthModal } from "../components/AuthModal";
import {
  AuthContext,
  type AuthContextValue,
  type AuthModalMode,
  type AuthStatus,
} from "./authContext";

type AuthProviderProps = {
  children: React.ReactNode;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<AuthModalMode>("login");
  const [searchParams, setSearchParams] = useSearchParams();

  const refreshUser = useCallback(async (): Promise<SessionUser | null> => {
    try {
      const me = await authApi.fetchMe();
      setUser(me);
      setStatus("authenticated");
      return me;
    } catch {
      setUser(null);
      setStatus("guest");
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  // `http.ts` emits this once a request could not be recovered with a refresh.
  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setStatus("guest");
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const openAuthModal = useCallback((mode: AuthModalMode = "login") => {
    setModalMode(mode);
    setIsModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // `RequireAuth` redirects to `/?auth=login`; open the modal and drop the param.
  useEffect(() => {
    const requested = searchParams.get("auth");
    if (requested !== "login" && requested !== "signup") {
      return;
    }

    openAuthModal(requested);

    const next = new URLSearchParams(searchParams);
    next.delete("auth");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, openAuthModal]);

  const login = useCallback(
    async (email: string, password: string) => {
      await authApi.login(email, password);
      const me = await refreshUser();
      if (!me) {
        throw new Error("Could not load the session");
      }
      return me;
    },
    [refreshUser]
  );

  const register = useCallback(
    async (email: string, password: string, username?: string) => {
      await authApi.register(email, password, username);
      const me = await refreshUser();
      if (!me) {
        throw new Error("Could not load the session");
      }
      return me;
    },
    [refreshUser]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setStatus("guest");
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      login,
      register,
      logout,
      refreshUser,
      openAuthModal,
      closeAuthModal,
    }),
    [user, status, login, register, logout, refreshUser, openAuthModal, closeAuthModal]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal
        isOpen={isModalOpen}
        initialMode={modalMode}
        onClose={closeAuthModal}
        onAuthSuccess={() => {
          void refreshUser();
          setIsModalOpen(false);
        }}
      />
    </AuthContext.Provider>
  );
};

export default AuthProvider;
