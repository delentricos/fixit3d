import { Plugin } from "../types";
import PluginActions from "./PluginActions";

interface PluginCardProps {
  plugin: Plugin;
}

function PluginCard({ plugin }: PluginCardProps) {
  const isActive = plugin.status === "active";

  return (
    <div
      style={{
        border: "1px solid #d1d5db",
        borderRadius: "12px",
        padding: "1rem",
        width: "320px",
        backgroundColor: "#ffffff",
        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
      }}
    >
      <h3
        style={{
          marginTop: 0,
        }}
      >
        {plugin.name}
      </h3>

      <p>
        <strong>Version:</strong> {plugin.version}
      </p>

      <p>
        <strong>Category:</strong> {plugin.category}
      </p>

      <p>
        <strong>Description:</strong>{" "}
        {plugin.description}
      </p>

      <p>
        <strong>Author:</strong>{" "}
        {plugin.author}
      </p>

      <div>
        <strong>Capabilities:</strong>

        <ul>
          {plugin.capabilities.map((capability) => (
            <li key={capability}>
              {capability}
            </li>
          ))}
        </ul>
      </div>

      <p>
        <strong>Status:</strong>{" "}
        <span
          style={{
            color: isActive ? "green" : "red",
            fontWeight: "bold",
          }}
        >
          {isActive ? "🟢 Active" : "🔴 Inactive"}
        </span>
      </p>
      <PluginActions pluginId={plugin.id} />
    </div>
  );
}

export default PluginCard;