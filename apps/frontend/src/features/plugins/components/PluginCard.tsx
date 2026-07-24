import { Plugin } from "../types";

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
        width: "300px",
        backgroundColor: "#ffffff",
        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
      }}
    >
      <h3
        style={{
          marginTop: 0,
          marginBottom: "1rem",
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
    </div>
  );
}

export default PluginCard;