import type { UserRole } from '../enums';

export type RegisterRequest = {
  email: string;
  password: string;
  username?: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type ChangePasswordRequest = {
  oldPassword: string;
  newPassword: string;
};

export type DeleteAccountRequest = {
  password: string;
};

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  avatarUrl?: string | null;
};

export type RegisterResponse = {
  message: string;
  user: AuthUser;
};

export type LoginResponse = {
  message: string;
  user: AuthUser;
  expiresIn: number;
};

export type RefreshResponse = {
  message: string;
  expiresIn: number;
};

export type LogoutResponse = {
  message: string;
};

export type MessageResponse = {
  message: string;
};
