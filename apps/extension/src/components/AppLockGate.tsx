import { FormEvent, useEffect, useRef, useState } from "react";
import { hasAppLock, setAppLock, verifyAppLock } from "../lib/appLock";

type LockState = "loading" | "setup" | "unlock" | "unlocked" | "error";

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LockState>("loading");
  const [error, setError] = useState("");
  const becameHidden = useRef(false);

  useEffect(() => {
    let active = true;
    void hasAppLock()
      .then((locked) => {
        if (active) setState(locked ? "unlock" : "setup");
      })
      .catch(() => {
        if (active) {
          setError("Unable to check app-lock settings. Please reload the extension.");
          setState("error");
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        becameHidden.current = true;
      } else if (becameHidden.current) {
        becameHidden.current = false;
        void hasAppLock().then((locked) => {
          if (locked) {
            setError("");
            setState("unlock");
          }
        });
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  if (state === "unlocked") return <>{children}</>;
  if (state === "loading") return <LockShell title="Checking app lock…" />;
  if (state === "error") {
    return <LockShell title="TrackIt is unavailable"><p className="message message-error">{error}</p></LockShell>;
  }

  return (
    <LockScreen
      mode={state}
      error={error}
      onUnlock={async (password) => {
        const valid = await verifyAppLock(password);
        if (!valid) {
          setError("That password is not correct.");
          return;
        }
        setError("");
        setState("unlocked");
      }}
      onSetup={async (password) => {
        await setAppLock(password);
        setError("");
        setState("unlocked");
      }}
    />
  );
}

function LockScreen({
  mode,
  error,
  onUnlock,
  onSetup,
}: {
  mode: "setup" | "unlock";
  error: string;
  onUnlock: (password: string) => Promise<void>;
  onSetup: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");
  const isSetup = mode === "setup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError("");
    if (isSetup && password.length < 8) {
      setLocalError("Choose at least 8 characters.");
      return;
    }
    if (isSetup && password !== confirmation) {
      setLocalError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      if (isSetup) await onSetup(password);
      else await onUnlock(password);
    } catch {
      setLocalError("Unable to update the app lock. Please try again.");
    } finally {
      setSubmitting(false);
      setPassword("");
      setConfirmation("");
    }
  }

  return (
    <LockShell title={isSetup ? "Protect your TrackIt data" : "TrackIt is locked"}>
      <p className="lock-copy">
        {isSetup
          ? "Create a local password to protect this browser extension whenever it opens."
          : "Enter your local password to view your personal details."}
      </p>
      <form className="lock-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>{isSetup ? "New password" : "Password"}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isSetup ? "new-password" : "current-password"}
            autoFocus
            required
          />
        </label>
        {isSetup && (
          <label className="field">
            <span>Confirm password</span>
            <input
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
        )}
        {(localError || error) && <p className="message message-error">{localError || error}</p>}
        <button className="button button-primary lock-submit" type="submit" disabled={submitting}>
          {submitting ? "Please wait…" : isSetup ? "Create app lock" : "Unlock TrackIt"}
        </button>
      </form>
      {isSetup && <p className="lock-note">Use a memorable password with words, numbers, or symbols. It is stored locally on this browser only.</p>}
    </LockShell>
  );
}

function LockShell({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="lock-shell">
      <section className="lock-card">
        <div className="lock-mark" aria-hidden="true">⌁</div>
        <span className="hero-badge">TrackIt</span>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}
