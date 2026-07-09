import { useCallback, useEffect, useRef, useState } from "react";
import { SignIn } from "@clerk/chrome-extension";
import { useAuthContext } from "../lib/auth/AuthProvider";

/**
 * AuthButton — displays Sign In / Sign Out based on auth state.
 *
 * When unauthenticated: shows a "Sign In" button that reveals the Clerk SignIn form.
 * When authenticated: shows the user's display name (or email) and a "Sign Out" button.
 * On session expiry: shows a non-blocking notification for 5 seconds.
 *
 * Requirements: 1.1, 1.2, 1.4, 1.5, 1.8
 */

const SESSION_EXPIRY_NOTIFICATION_MS = 5000;

export function AuthButton() {
  const { isSignedIn, isLoading, user, signOut } = useAuthContext();
  const [signingOut, setSigningOut] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const notificationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSignedIn = useRef<boolean | null>(null);

  // Detect session expiry: was signed in, now not signed in, and not due to manual sign-out
  useEffect(() => {
    if (prevSignedIn.current === true && !isSignedIn && !signingOut && !isLoading) {
      setNotification("Your session has expired. Please sign in again.");
      notificationTimer.current = setTimeout(() => {
        setNotification(null);
      }, SESSION_EXPIRY_NOTIFICATION_MS);
    }
    if (!isLoading) {
      prevSignedIn.current = isSignedIn;
    }

    return () => {
      if (notificationTimer.current) {
        clearTimeout(notificationTimer.current);
      }
    };
  }, [isSignedIn, isLoading, signingOut]);

  // Hide sign-in form once authenticated
  useEffect(() => {
    if (isSignedIn) {
      setShowSignIn(false);
    }
  }, [isSignedIn]);

  const handleSignIn = useCallback(() => {
    setShowSignIn(true);
  }, []);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }, [signOut]);

  const displayName = user?.name || user?.email || "";

  if (isLoading) {
    return (
      <div className="auth-button-container">
        <span className="auth-loading" aria-live="polite">
          Loading…
        </span>
      </div>
    );
  }

  return (
    <div className="auth-button-container">
      {notification && (
        <div
          className="auth-notification"
          role="status"
          aria-live="polite"
        >
          {notification}
        </div>
      )}

      {isSignedIn ? (
        <div className="auth-user-info">
          <span className="auth-user-name" title={user?.email}>
            {displayName}
          </span>
          <button
            type="button"
            className="button button-secondary auth-sign-out-btn"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            aria-label="Sign out"
          >
            {signingOut ? "Signing out…" : "Sign Out"}
          </button>
        </div>
      ) : showSignIn ? (
        <div className="auth-signin-form">
          <button
            type="button"
            className="button button-link"
            onClick={() => setShowSignIn(false)}
            style={{ marginBottom: "8px", fontSize: "0.8rem" }}
          >
            ← Back
          </button>
          <SignIn
            routing="hash"
            signUpUrl="#/sign-up"
            appearance={{
              elements: {
                rootBox: { width: "100%" },
                card: { boxShadow: "none", border: "none" },
              },
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          className="button button-primary auth-sign-in-btn"
          onClick={handleSignIn}
          aria-label="Sign in to sync your data"
        >
          Sign In
        </button>
      )}
    </div>
  );
}
