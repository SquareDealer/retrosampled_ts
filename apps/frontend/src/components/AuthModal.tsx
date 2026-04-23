import React, { useState } from "react";
import "./AuthModal.css";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "signup";
  onAuthSuccess?: (user: AuthUser) => void;
}

type AuthUser = {
  id?: string;
  sub?: string;
  email?: string;
};

type FormErrors = {
  email?: string;
  password?: string;
  repeatPassword?: string;
};

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = "login",
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<"login" | "signup" | "email-sent">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  if (!isOpen) return null;

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(email)) {
      newErrors.email = "Invalid email format";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (mode === "signup") {
      if (!repeatPassword) {
        newErrors.repeatPassword = "Please repeat your password";
      } else if (password !== repeatPassword) {
        newErrors.repeatPassword = "Passwords do not match";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setGeneralError(null);

    const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message;
        throw new Error(errorMessage || "Something went wrong");
      }

      if (data.user && (mode === "login" || data.message === "Registered and logged in")) {
        onAuthSuccess?.(data.user as AuthUser);
      }

      // При регистрации показываем экран подтверждения email
      if (mode === "signup") {
        if (data.message === "Registered and logged in") {
          handleClose();
          return;
        }

        setSentEmail(email);
        setMode("email-sent");
        setEmail("");
        setPassword("");
        setRepeatPassword("");
      } else {
        handleClose();
      }
    } catch (err: any) {
      setGeneralError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setPassword("");
    setRepeatPassword("");
    setErrors({});
    setGeneralError(null);
    setIsSubmitting(false);
    setSentEmail("");
    setMode(initialMode);
    onClose();
  };

  const switchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setErrors({});
    setGeneralError(null);
    setRepeatPassword("");
  };

  const handleGoogleAuth = () => {
    console.log("Google auth clicked");
    // Здесь будет логика авторизации через Google
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={handleOverlayClick}>
      <div className="auth-modal">
        <button className="auth-modal__close" onClick={handleClose}>
          ×
        </button>

        <div className="auth-modal__header">
          <h2 className="auth-modal__title">
            {mode === "login" ? "Log-In" : mode === "signup" ? "Sign-Up" : "Check Your Email"}
          </h2>
        </div>

        {mode === "email-sent" ? (
          <div className="auth-modal__email-sent">
            <div className="auth-modal__email-sent-icon">
              ✉
            </div>
            <p className="auth-modal__email-sent-text">
              We've sent a confirmation link to
            </p>
            <p className="auth-modal__email-sent-address">
              {sentEmail}
            </p>
            <p className="auth-modal__email-sent-hint">
              Please check your inbox and click the link to verify your account.
            </p>
            <button
              type="button"
              className="auth-modal__submit"
              onClick={handleClose}
            >
              Got it
            </button>
            <div className="auth-modal__switch">
              Didn't receive the email?{" "}
              <button
                type="button"
                className="auth-modal__switch-btn"
                onClick={() => console.log("Resend email clicked")}
              >
                Resend
              </button>
            </div>
          </div>
        ) : (
        <form className="auth-modal__form" onSubmit={handleSubmit}>
          <div className="auth-modal__field">
            <label className="auth-modal__label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className={`auth-modal__input ${
                errors.email ? "auth-modal__input--error" : ""
              }`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              disabled={isSubmitting}
            />
            {errors.email && (
              <span className="auth-modal__error">{errors.email}</span>
            )}
          </div>

          <div className="auth-modal__field">
            <label className="auth-modal__label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className={`auth-modal__input ${
                errors.password ? "auth-modal__input--error" : ""
              }`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isSubmitting}
            />
            {errors.password && (
              <span className="auth-modal__error">{errors.password}</span>
            )}
          </div>

          {mode === "login" && (
            <button
              type="button"
              className="auth-modal__forgot"
              onClick={() => console.log("Forgot password clicked")}
            >
              Forgot password?
            </button>
          )}

          {mode === "signup" && (
            <div className="auth-modal__field">
              <label className="auth-modal__label" htmlFor="repeat-password">
                Repeat Password
              </label>
              <input
                id="repeat-password"
                type="password"
                className={`auth-modal__input ${
                  errors.repeatPassword ? "auth-modal__input--error" : ""
                }`}
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isSubmitting}
              />
              {errors.repeatPassword && (
                <span className="auth-modal__error">
                  {errors.repeatPassword}
                </span>
              )}
            </div>
          )}

          {generalError && (
            <div className="auth-modal__error auth-modal__error--general">
              {generalError}
            </div>
          )}

          <button
            type="submit"
            className="auth-modal__submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Loading..."
              : mode === "login"
              ? "Log-In"
              : "Sign-Up"}
          </button>

          {mode === "signup" && (
            <>
              <div className="auth-modal__divider">
                <span>or</span>
              </div>

              <button
                type="button"
                className="auth-modal__google"
                onClick={handleGoogleAuth}
                disabled={isSubmitting}
              >
                <svg
                  className="auth-modal__google-icon"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </button>
            </>
          )}

          <div className="auth-modal__switch">
            {mode === "login" ? (
              <>
                Don't have an account?{" "}
                <button
                  type="button"
                  className="auth-modal__switch-btn"
                  onClick={switchMode}
                >
                  Sign-Up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="auth-modal__switch-btn"
                  onClick={switchMode}
                >
                  Log-In
                </button>
              </>
            )}
          </div>
        </form>
        )}
      </div>
    </div>
  );
};
