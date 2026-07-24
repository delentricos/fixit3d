import { useEffect, useState } from "react";
import { api } from "../../api/client";
import StatusCard from "./components/StatusCard";
import PluginCard from "../plugins/components/PluginCard";
import { Plugin } from "../plugins/types";

type BackendStatus = "checking" | "connected" | "disconnected";

function DashboardPage() {
  const [status, setStatus] =
    useState<BackendStatus>("checking");

  const [version, setVersion] = useState("Loading...");

  const [plugins, setPlugins] = useState<Plugin[]>([]);

  useEffect(() => {
    async function loadBackend() {
      try {
        await api.health();

        setStatus("connected");

        const data = await api.version();
        setVersion(data.version);

        const pluginData = await api.plugins();
        setPlugins(pluginData);

      } catch {
        setStatus("disconnected");
      }
    }

    loadBackend();
  }, []);

  return (
    <main
      style={{
        padding: "2rem",
      }}
    >
      <h1>FixIt3D Dashboard</h1>

      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginTop: "2rem",
          flexWrap: "wrap",
        }}
      >
        <StatusCard
          title="Backend"
          value={
            status === "connected"
              ? "FastAPI"
              : "Offline"
          }
          status={
            status === "connected"
              ? "success"
              : "error"
          }
        />

        <StatusCard
          title="API Version"
          value={version}
          status="neutral"
        />

                <StatusCard
          title="AI Engine"
          value="Ready"
          status="neutral"
        />
      </div>

      <div
        style={{
          marginTop: "2rem",
        }}
      >
        <h2>Plugins</h2>

        <div
  style={{
    marginTop: "1rem",
  }}
>
  {plugins.map((plugin) => (
    <PluginCard
      key={plugin.id}
      plugin={plugin}
    />
  ))}
</div>
      </div>
    </main>
  );
}

export default DashboardPage;