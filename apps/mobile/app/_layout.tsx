import "react-native-url-polyfill/auto";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";

const tokenCache = {
  async getToken(key: string) {
    try {
      const val = await SecureStore.getItemAsync(key);
      console.log("[tokenCache] getToken", key, "→", val ? "found" : "null");
      return val;
    } catch (e) {
      console.log("[tokenCache] getToken error", e);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      console.log("[tokenCache] saveToken", key);
      await SecureStore.setItemAsync(key, value);
      console.log("[tokenCache] saveToken done", key);
    } catch (e) {
      console.log("[tokenCache] saveToken error", e);
    }
  },
  async clearToken(key: string) {
    try { await SecureStore.deleteItemAsync(key); } catch {}
  },
};

function AuthGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    const inAuth = segments[0] === "(auth)";
    console.log("[AuthGate] isLoaded:", isLoaded, "isSignedIn:", isSignedIn, "inAuth:", inAuth);
    if (!isSignedIn && !inAuth) {
      console.log("[AuthGate] → redirecting to sign-in");
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && inAuth) {
      console.log("[AuthGate] → redirecting to tabs");
      router.replace("/(tabs)/");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  return <Slot />;
}

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) throw new Error("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set");

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <StatusBar style="dark" backgroundColor="#f5efe5" />
      <AuthGate />
    </ClerkProvider>
  );
}
