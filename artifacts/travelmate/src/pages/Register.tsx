import { useState } from "react";
import { supabase } from "../supabaseClient";

type RegisterProps = {
  onSwitchToLogin: () => void;
};

export default function Register({ onSwitchToLogin }: RegisterProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Account created successfully.");
    }

    setLoading(false);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h1 style={styles.title}>Create account</h1>
        <p style={styles.subtitle}>TravelMate</p>

        <form onSubmit={handleRegister} style={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />

          <input
            type="password"
            placeholder="Parolă"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.input}
          />

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Creating..." : "Sign up"}
          </button>
        </form>

        {message ? <p style={styles.message}>{message}</p> : null}

        <p style={styles.switchText}>
          Already have an account?{" "}
          <button type="button" onClick={onSwitchToLogin} style={styles.linkButton}>
            Log in
          </button>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "linear-gradient(135deg, #0f172a, #1e1b4b, #312e81)",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    padding: "28px",
    borderRadius: "24px",
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(12px)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    color: "#fff",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 700,
  },
  subtitle: {
    marginTop: "8px",
    marginBottom: "20px",
    color: "rgba(255,255,255,0.75)",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  input: {
    padding: "14px 16px",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.15)",
    outline: "none",
    fontSize: "15px",
  },
  button: {
    marginTop: "8px",
    padding: "14px 16px",
    borderRadius: "14px",
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "15px",
  },
  message: {
    marginTop: "16px",
    fontSize: "14px",
    color: "#e9d5ff",
  },
  switchText: {
    marginTop: "16px",
    fontSize: "14px",
    color: "rgba(255,255,255,0.8)",
  },
  linkButton: {
    background: "transparent",
    border: "none",
    color: "#c4b5fd",
    cursor: "pointer",
    fontWeight: 700,
    padding: 0,
  },
};