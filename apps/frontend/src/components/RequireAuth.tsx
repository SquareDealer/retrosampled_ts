import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

type RequireAuthProps = {
  children?: React.ReactNode;
  /** Where to send guests; the auth modal opens from the `?auth=` param. */
  redirectTo?: string;
};

/**
 * Gate for authenticated routes. Guests are sent to `/?auth=login` with the
 * attempted location in `state.from` so the app can come back to it.
 */
export const RequireAuth: React.FC<RequireAuthProps> = ({
  children,
  redirectTo = "/?auth=login",
}) => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return null;
  }

  if (status === "guest") {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  return <>{children ?? <Outlet />}</>;
};

export default RequireAuth;
