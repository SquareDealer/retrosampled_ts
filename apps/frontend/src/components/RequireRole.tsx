import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { UserRole } from "@retrosampled/shared";
import { useAuth } from "../auth/useAuth";

type RequireRoleProps = {
  /** Account role the route demands. `ADMIN` satisfies every role. */
  role: UserRole;
  children?: React.ReactNode;
  /** Where to send guests (the auth modal opens from the `?auth=` param). */
  guestRedirectTo?: string;
  /**
   * What a signed-in user without the role sees. By default they are bounced to
   * `/`; pass `"forbidden"` to render an inline 403 instead, or any element.
   */
  fallback?: "redirect" | "forbidden" | React.ReactNode;
  /** Where the default `"redirect"` fallback sends them. */
  redirectTo?: string;
};

const Forbidden: React.FC = () => (
  <main className="require-role-forbidden">
    <p className="require-role-forbidden__code">403</p>
    <h1 className="require-role-forbidden__title">Not your crate</h1>
    <p className="require-role-forbidden__body">
      This area is for administrators only.
    </p>
  </main>
);

/**
 * Role gate for a route, the mirror image of the backend's `@Roles()`.
 *
 * `RequireAuth` decides *whether* you are signed in; this one decides whether
 * your account role is enough. Compose them: `RequireAuth` outside,
 * `RequireRole` inside, so a guest gets the login modal rather than a 403.
 *
 * While the session is still loading nothing is rendered — the same
 * passthrough `RequireAuth` uses, so a refresh never flashes a 403.
 */
export const RequireRole: React.FC<RequireRoleProps> = ({
  role,
  children,
  guestRedirectTo = "/?auth=login",
  fallback = "redirect",
  redirectTo = "/",
}) => {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return null;
  }

  if (status === "guest" || !user) {
    return <Navigate to={guestRedirectTo} replace state={{ from: location }} />;
  }

  // ADMIN passes every gate, exactly like the backend RolesGuard.
  const allowed = user.role === role || user.role === "ADMIN";

  if (!allowed) {
    if (fallback === "forbidden") {
      return <Forbidden />;
    }
    if (fallback === "redirect") {
      return <Navigate to={redirectTo} replace />;
    }
    return <>{fallback}</>;
  }

  return <>{children ?? <Outlet />}</>;
};

export default RequireRole;
