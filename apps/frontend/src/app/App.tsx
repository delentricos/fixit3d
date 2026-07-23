import { useEffect, useState } from "react";
import { api } from "../api/client";

type BackendStatus = "checking" | "connected" | "disconnected";


function App() {
  const [status, setStatus] = useState<BackendStatus>("checking");

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
  try {
    await api.health();

    if (!cancelled) {
      setStatus("connected");
    }
  } catch {
    if (!cancelled) {
      setStatus("disconnected");
    }
  }
}

    checkHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  const statusLabel = {
    checking: "Checking backend...",
    connected: "🟢 Connected",
    disconnected: "🔴 Disconnected",
  }[status];

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "0.5rem",
      }}
    >
      <h1>FixIt3D</h1>
      <p>Frontend running</p>
      <p>{statusLabel}</p>
    </main>
  );
}

export default App;