import { FormEvent, useState } from "react";
import { removeAppLock, setAppLock, verifyAppLock } from "../lib/appLock";

export function AppLockSettings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (newPassword.length < 8) {
      setError("Choose at least 8 characters.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("New passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      if (!await verifyAppLock(currentPassword)) {
        setError("Your current password is not correct.");
        return;
      }
      await setAppLock(newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setMessage("App-lock password updated.");
    } catch {
      setError("Unable to update the password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove() {
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      if (!await verifyAppLock(currentPassword)) {
        setError("Enter your current password before removing app lock.");
        return;
      }
      await removeAppLock();
      setCurrentPassword("");
      setMessage("App lock removed. It will no longer be requested when opening TrackIt.");
    } catch {
      setError("Unable to remove the app lock. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="security-panel">
      <div className="section-title">
        <div>
          <h2>App lock</h2>
          <p className="muted">A local password is required whenever the popup or this page opens.</p>
        </div>
      </div>
      <form className="security-form" onSubmit={handleChange}>
        <label className="field">
          <span>Current password</span>
          <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required />
        </label>
        <label className="field">
          <span>New password</span>
          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" required />
        </label>
        <label className="field">
          <span>Confirm new password</span>
          <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required />
        </label>
        {error && <p className="message message-error">{error}</p>}
        {message && <p className="message message-success">{message}</p>}
        <div className="button-row">
          <button className="button button-primary" type="submit" disabled={submitting}>Update password</button>
          <button className="button button-danger" type="button" onClick={() => void handleRemove()} disabled={submitting}>Remove app lock</button>
        </div>
      </form>
    </section>
  );
}
