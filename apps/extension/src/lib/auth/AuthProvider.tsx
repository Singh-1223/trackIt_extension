import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ClerkProvider, useAuth as useClerkAuth, useUser as useClerkUser } from "@clerk/chrome-extension";
import {
  clearToken,
  getToken,
  refreshToken,
  setRefreshCallback,
  storeToken,
  validateToken,
} from "./tokenManager";

/**
 * The publishable key for Clerk authentication.
 * In production this would come from an environment variable or build-time config.
 */
const CLERK_PUBLISHABLE_KEY =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "pk_test_placeholder";

// --- AuthContext definition ---

export interface AuthContextValue {
  isSignedIn: boolean;
  isLoading: boolean;
  user: { name?: string; email: string } | null;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  isSignedIn: false,
  isLoading: true,
  user: null,
  getToken: async () => null,
  signOut: async () => {},
});

export function useAuthContext(): AuthContextValue {
  return useContext(AuthContext);
}

// --- Token validation timeout (5 seconds per Requirement 1.9) ---
const TOKEN_VALIDATION_TIMEOUT_MS = 5000;

// --- Inner provider that has access to Clerk hooks ---

function AuthInner({ children }: { children: React.ReactNode }) {
  const {
    isSignedIn: clerkIsSignedIn,
    isLoaded: clerkIsLoaded,
    signOut: clerkSignOut,
    getToken: clerkGetToken,
  } = useClerkAuth();
  const { user: clerkUser } = useClerkUser();

  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);

  // Register the Clerk token refresh callback with TokenManager
  useEffect(() => {
    setRefreshCallback(async () => {
      const token = await clerkGetToken({ skipCache: true });
      return token;
    });
  }, [clerkGetToken]);

  // On mount: validate stored token within 5 seconds (Requirement 1.9)
  useEffect(() => {
    if (hasInitialized.current) return;
    if (!clerkIsLoaded) return;

    hasInitialized.current = true;

    const validate = async () => {
      try {
        const isValid = await Promise.race([
          validateToken(),
          new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error("Token validation timeout")), TOKEN_VALIDATION_TIMEOUT_MS)
          ),
        ]);

        if (isValid && clerkIsSignedIn) {
          setIsSignedIn(true);
        } else if (!isValid && clerkIsSignedIn) {
          // Token in session storage is invalid but Clerk thinks we're signed in
          // Try to get a fresh token from Clerk
          const freshToken = await clerkGetToken();
          if (freshToken) {
            await storeToken(freshToken);
            setIsSignedIn(true);
          } else {
            setIsSignedIn(false);
          }
        } else {
          setIsSignedIn(false);
        }
      } catch {
        // Timeout or error → transition to unauthenticated
        setIsSignedIn(false);
      } finally {
        setIsLoading(false);
      }
    };

    void validate();
  }, [clerkIsLoaded, clerkIsSignedIn, clerkGetToken]);

  // Sync Clerk auth state changes after initial load
  useEffect(() => {
    if (!clerkIsLoaded || !hasInitialized.current) return;

    const syncClerkState = async () => {
      if (clerkIsSignedIn) {
        const token = await clerkGetToken();
        if (token) {
          await storeToken(token);
          setIsSignedIn(true);
        }
      } else {
        await clearToken();
        setIsSignedIn(false);
      }
      setIsLoading(false);
    };

    void syncClerkState();
  }, [clerkIsSignedIn, clerkIsLoaded, clerkGetToken]);

  // Handle token expiry: attempt refresh up to 3 times with 2s delay (Requirement 1.7, 1.8)
  const handleTokenExpiry = useCallback(async (): Promise<string | null> => {
    const newToken = await refreshToken(3);
    if (!newToken) {
      // All refresh attempts failed → transition to unauthenticated
      await clearToken();
      setIsSignedIn(false);
    }
    return newToken;
  }, []);

  // Expose getToken: retrieves token from session storage, handles expiry
  const getTokenFn = useCallback(async (): Promise<string | null> => {
    const token = await getToken();
    if (!token) return null;

    const isValid = await validateToken();
    if (isValid) return token;

    // Token expired or invalid — attempt refresh
    return handleTokenExpiry();
  }, [handleTokenExpiry]);

  // Expose signOut: clear token and sign out of Clerk
  const signOutFn = useCallback(async (): Promise<void> => {
    await clearToken();
    setIsSignedIn(false);
    await clerkSignOut();
  }, [clerkSignOut]);

  // Build user object from Clerk user data
  const user = useMemo(() => {
    if (!clerkIsSignedIn || !clerkUser) return null;
    const email =
      clerkUser.primaryEmailAddress?.emailAddress ?? "";
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || undefined;
    return { name, email };
  }, [clerkIsSignedIn, clerkUser]);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      isSignedIn,
      isLoading,
      user,
      getToken: getTokenFn,
      signOut: signOutFn,
    }),
    [isSignedIn, isLoading, user, getTokenFn, signOutFn]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

// --- Public AuthProvider component ---

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} telemetry={false}>
      <AuthInner>{children}</AuthInner>
    </ClerkProvider>
  );
}
