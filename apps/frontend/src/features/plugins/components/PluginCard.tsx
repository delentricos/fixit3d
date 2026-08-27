import { useState } from "react";
import { Plugin } from "../types";
import PluginActions from "./PluginActions";

interface PluginCardProps {
  plugin: Plugin;
  onPluginChanged: () => void;
  onPluginDetails: (plugin: Plugin) => void;
}

function PluginCard({ plugin, onPluginChanged, onPluginDetails }: PluginCardProps) {
  const isActive = plugin.status === "active";
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "7px",
        width: "100%",
        boxSizing: "border-box",
        padding: "6px 8px",
        borderRadius: "5px",
        marginBottom: "2px",
        background: hovered ? "#1a2028" : "transparent",
        border: "1px solid transparent",
      }}
    >
      <span
        style={{
          width: "17px",
          color: "#788494",
          fontSize: "13px",
          lineHeight: 1,
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        ▣
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 450,
            color: "#c3cad4",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {plugin.name}
        </div>

        <div
          style={{
            fontSize: "10px",
            color: "#7f8998",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          v{plugin.version} • {isActive ? "Active" : "Inactive"}
        </div>
      </div>

      <PluginActions
        plugin={plugin}
        onPluginChanged={onPluginChanged}
        onPluginDetails={onPluginDetails}
      />
    </div>
  );
}

export default PluginCard;