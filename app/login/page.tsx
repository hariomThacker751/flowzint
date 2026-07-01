"use client";

import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Login failed");
        return;
      }
      const params = new URLSearchParams(window.location.search);
      window.location.href = params.get("next") || "/";
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0f1a" }}>
      <form
        onSubmit={onSubmit}
        style={{ width: 320, padding: 28, borderRadius: 12, background: "#fff", boxShadow: "0 10px 40px rgba(0,0,0,.3)" }}
      >
        <h1 style={{ margin: "0 0 4px", fontSize: 20 }}>Anjani Sales OS</h1>
        <p style={{ margin: "0 0 18px", color: "#666", fontSize: 13 }}>Sign in to continue</p>
        <label style={{ fontSize: 12, color: "#444" }}>Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          style={{ width: "100%", padding: 10, margin: "4px 0 12px", border: "1px solid #ccc", borderRadius: 8 }}
        />
        <label style={{ fontSize: 12, color: "#444" }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          style={{ width: "100%", padding: 10, margin: "4px 0 16px", border: "1px solid #ccc", borderRadius: 8 }}
        />
        {error && <div style={{ color: "#c00", fontSize: 13, marginBottom: 10 }}>{error}</div>}
        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", padding: 11, border: 0, borderRadius: 8, background: "#1a56db", color: "#fff", fontWeight: 600, cursor: "pointer" }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

