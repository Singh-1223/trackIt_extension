import { useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, fontSize, radius, spacing } from "../../theme";

export default function SignUp() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!isLoaded) return;
    setLoading(true);
    setError("");
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sign up failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!isLoaded) return;
    setLoading(true);
    setError("");
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        // AuthGate in _layout.tsx handles redirect once isSignedIn flips
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.card}>
        <View style={s.badge}>
          <Text style={s.badgeText}>TrackIt</Text>
        </View>
        <Text style={s.title}>{pendingVerification ? "Verify email" : "Create account"}</Text>
        <Text style={s.subtitle}>
          {pendingVerification
            ? "Enter the code we sent to your email"
            : "Start tracking your daily accountability"}
        </Text>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {pendingVerification ? (
          <>
            <TextInput
              style={s.input}
              placeholder="Verification code"
              placeholderTextColor={colors.inkSoft}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="one-time-code"
            />
            <TouchableOpacity style={s.primaryBtn} onPress={handleVerify} disabled={loading}>
              <Text style={s.primaryBtnText}>{loading ? "Verifying…" : "Verify"}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={s.input}
              placeholder="Email"
              placeholderTextColor={colors.inkSoft}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextInput
              style={s.input}
              placeholder="Password"
              placeholderTextColor={colors.inkSoft}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity style={s.primaryBtn} onPress={handleSignUp} disabled={loading}>
              <Text style={s.primaryBtnText}>{loading ? "Creating account…" : "Sign up"}</Text>
            </TouchableOpacity>
          </>
        )}

        {!pendingVerification && (
          <TouchableOpacity onPress={() => router.push("/(auth)/sign-in")} style={s.linkRow}>
            <Text style={s.linkText}>Already have an account? Sign in →</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    marginBottom: spacing.md,
  },
  badgeText: { color: colors.white, fontSize: fontSize.xs, fontWeight: "700", letterSpacing: 0.5 },
  title: { fontSize: fontSize.xxl, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs },
  subtitle: { fontSize: fontSize.sm, color: colors.inkSoft, marginBottom: spacing.lg },
  error: { fontSize: fontSize.sm, color: colors.danger, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    fontSize: fontSize.base,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  primaryBtnText: { color: colors.white, fontSize: fontSize.base, fontWeight: "700" },
  linkRow: { marginTop: spacing.md, alignItems: "center" },
  linkText: { fontSize: fontSize.sm, color: colors.accentStrong, fontWeight: "600" },
});
