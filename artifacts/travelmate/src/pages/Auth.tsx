type AuthProps = {
  onLogin: () => void;
  onRegister: () => void;
  onBack: () => void;
};

export default function Auth({ onLogin, onRegister, onBack }: AuthProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "linear-gradient(135deg, #0b1020, #1e1b4b, #312e81)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          padding: "32px",
          borderRadius: "28px",
          background: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(14px)",
          boxShadow: "0 14px 40px rgba(0,0,0,0.28)",
          color: "#fff",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          Welcome to TravelMate
        </p>

        <h1 style={{ marginTop: 10, marginBottom: 10, fontSize: 36, lineHeight: 1.1 }}>
          Start your next journey
        </h1>

        <p style={{ color: "rgba(255,255,255,0.78)", marginBottom: 24, lineHeight: 1.6 }}>
          Create an account or log in to save itineraries, build your travel profile,
          and access your trips anytime.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <button
            onClick={onRegister}
            style={{
              padding: "15px 18px",
              borderRadius: 16,
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            Create account
          </button>

          <button
            onClick={onLogin}
            style={{
              padding: "15px 18px",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            Log in
          </button>

          <button
            onClick={onBack}
            style={{
              marginTop: 8,
              padding: "12px 18px",
              borderRadius: 14,
              border: "none",
              background: "transparent",
              color: "rgba(255,255,255,0.75)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}