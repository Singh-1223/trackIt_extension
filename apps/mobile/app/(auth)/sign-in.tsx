import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, fontSize, radius, spacing } from "../../theme";

type Step = "sign-in" | "two-factor" | "forgot-email" | "forgot-code" | "forgot-new-password";

export default function SignIn() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [step, setStep] = useState<Step>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [tfaCode, setTfaCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!isLoaded) return;
    setLoading(true);
    setError("");
    try {
      console.log("[SignIn] attempting sign-in for:", email);
      const result = await signIn.create({ identifier: email, password });
      console.log("[SignIn] result.status:", result.status);
      if (result.status === "complete") {
        console.log("[SignIn] calling setActive, session:", result.createdSessionId);
        await setActive({ session: result.createdSessionId });
        console.log("[SignIn] setActive done — waiting for AuthGate to redirect");
      } else if (result.status === "needs_second_factor") {
        setStep("two-factor");
      }
    } catch (e: unknown) {
      console.log("[SignIn] error:", e);
      setError(e instanceof Error ? e.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTwoFactor() {
    if (!isLoaded) return;
    setLoading(true);
    setError("");
    try {
      const result = await signIn.attemptSecondFactor({
        strategy: "totp",
        code: tfaCode,
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotSendCode() {
    if (!isLoaded || !email.trim()) { setError("Enter your email first."); return; }
    setLoading(true);
    setError("");
    try {
      await signIn.create({ identifier: email });
      const factor = signIn.supportedFirstFactors?.find(
        (f): f is typeof f & { emailAddressId: string } =>
          f.strategy === "reset_password_email_code" && "emailAddressId" in f
      );
      if (!factor) throw new Error("Password reset not available for this account.");
      await signIn.prepareFirstFactor({
        strategy: "reset_password_email_code",
        emailAddressId: factor.emailAddressId,
      });
      setStep("forgot-code");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send reset code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotVerifyCode() {
    if (!isLoaded) return;
    setLoading(true);
    setError("");
    try {
      const result = await signIn.attemptFirstFactor({ strategy: "reset_password_email_code", code });
      if (result.status === "needs_new_password") {
        setStep("forgot-new-password");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetNewPassword() {
    if (!isLoaded || newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError("");
    try {
      const result = await signIn.resetPassword({ password: newPassword });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        // AuthGate in _layout.tsx handles redirect once isSignedIn flips
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to set new password.");
    } finally {
      setLoading(false);
    }
  }

  function resetToSignIn() {
    setStep("sign-in");
    setCode("");
    setNewPassword("");
    setError("");
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <View style={s.badge}>
            <Text style={s.badgeText}>TrackIt</Text>
          </View>

          {/* ── Sign in ── */}
          {step === "sign-in" && (
            <>
              <Text style={s.title}>Welcome back</Text>
              <Text style={s.subtitle}>Sign in to sync your data across devices</Text>
              {error ? <Text style={s.error}>{error}</Text> : null}
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
              <TouchableOpacity style={s.primaryBtn} onPress={handleSignIn} disabled={loading}>
                <Text style={s.primaryBtnText}>{loading ? "Signing in…" : "Sign in"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setError(""); setStep("forgot-email"); }} style={s.linkRow}>
                <Text style={s.linkText}>Forgot password?</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/(auth)/sign-up")} style={[s.linkRow, { marginTop: spacing.xs }]}>
                <Text style={s.linkText}>Don't have an account? Sign up →</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Two-factor auth ── */}
          {step === "two-factor" && (
            <>
              <Text style={s.title}>Two-factor auth</Text>
              <Text style={s.subtitle}>Enter the code from your authenticator app</Text>
              {error ? <Text style={s.error}>{error}</Text> : null}
              <TextInput
                style={s.input}
                placeholder="6-digit code"
                placeholderTextColor={colors.inkSoft}
                value={tfaCode}
                onChangeText={setTfaCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                autoFocus
              />
              <TouchableOpacity style={s.primaryBtn} onPress={handleTwoFactor} disabled={loading}>
                <Text style={s.primaryBtnText}>{loading ? "Verifying…" : "Verify"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setStep("sign-in"); setTfaCode(""); setError(""); }} style={s.linkRow}>
                <Text style={s.linkText}>← Back to sign in</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Forgot: enter email ── */}
          {step === "forgot-email" && (
            <>
              <Text style={s.title}>Reset password</Text>
              <Text style={s.subtitle}>We'll send a code to your email</Text>
              {error ? <Text style={s.error}>{error}</Text> : null}
              <TextInput
                style={s.input}
                placeholder="Email"
                placeholderTextColor={colors.inkSoft}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoFocus
              />
              <TouchableOpacity style={s.primaryBtn} onPress={handleForgotSendCode} disabled={loading}>
                <Text style={s.primaryBtnText}>{loading ? "Sending…" : "Send code"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={resetToSignIn} style={s.linkRow}>
                <Text style={s.linkText}>← Back to sign in</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Forgot: enter OTP code ── */}
          {step === "forgot-code" && (
            <>
              <Text style={s.title}>Enter code</Text>
              <Text style={s.subtitle}>Check your email for the reset code</Text>
              {error ? <Text style={s.error}>{error}</Text> : null}
              <TextInput
                style={s.input}
                placeholder="Reset code"
                placeholderTextColor={colors.inkSoft}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                autoFocus
              />
              <TouchableOpacity style={s.primaryBtn} onPress={handleForgotVerifyCode} disabled={loading}>
                <Text style={s.primaryBtnText}>{loading ? "Verifying…" : "Verify code"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={resetToSignIn} style={s.linkRow}>
                <Text style={s.linkText}>← Back to sign in</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Forgot: set new password ── */}
          {step === "forgot-new-password" && (
            <>
              <Text style={s.title}>New password</Text>
              <Text style={s.subtitle}>Choose a strong password (min 8 characters)</Text>
              {error ? <Text style={s.error}>{error}</Text> : null}
              <TextInput
                style={s.input}
                placeholder="New password"
                placeholderTextColor={colors.inkSoft}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoFocus
              />
              <TouchableOpacity style={s.primaryBtn} onPress={handleSetNewPassword} disabled={loading}>
                <Text style={s.primaryBtnText}>{loading ? "Saving…" : "Set new password"}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.xl },
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
