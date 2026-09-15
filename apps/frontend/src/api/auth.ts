import type {
  LoginResponse,
  MeResponse,
  MessageResponse,
  RefreshResponse,
  RegisterResponse,
  SessionUser,
} from "@retrosampled/shared";
import { get, post } from "./http";

export const login = (email: string, password: string) =>
  post<LoginResponse>("/auth/login", { email, password }, { skipAuthRefresh: true });

export const register = (email: string, password: string, username?: string) =>
  post<RegisterResponse>(
    "/auth/register",
    username ? { email, password, username } : { email, password },
    { skipAuthRefresh: true }
  );

export const logout = () =>
  post<MessageResponse>("/auth/logout", undefined, { skipAuthRefresh: true });

export const refresh = () =>
  post<RefreshResponse>("/auth/refresh", undefined, { skipAuthRefresh: true });

export const changePassword = (oldPassword: string, newPassword: string) =>
  post<MessageResponse>("/auth/change-password", { oldPassword, newPassword });

export async function fetchMe(): Promise<SessionUser> {
  const response = await get<MeResponse>("/auth/me");
  return response.user;
}
