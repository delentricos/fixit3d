import { useEffect, useRef, useState } from "react";
import { api } from "../../../api/client";
import { Plugin } from "../types";

interface PluginActionsProps {
  plugin: Plugin;
  onPluginChanged: () => void;
  onPluginDetails: (plugin: Plugin) => void;
}
function PluginActions({
  plugin,
  onPluginChanged,
  onPluginDetails,
}: PluginActionsProps) {
  const pluginId = plugin.id;
  const isActive = plugin.status === "active";

  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  async function handleEnable() {
    try {
      await api.enablePlugin(pluginId);

      onPluginChanged();

      console.log("Plugin enabled:", pluginId);
    } catch (error) {
      console.error("Enable failed:", error);
    } finally {
      setMenuOpen(false);
    }
  }

  async function handleDisable() {
    try {
      await api.disablePlugin(pluginId);

      onPluginChanged();

      console.log("Plugin disabled:", pluginId);
    } catch (error) {
      console.error("Disable failed:", error);
    } finally {
      setMenuOpen(false);
    }
  }

  const menuItemStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "6px 10px",
    border: "none",
    background: "transparent",
    color: "#c3cad4",
    fontSize: "12px",
    cursor: "pointer",
    borderRadius: "4px",
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Plugin actions"
        style={{
          width: "20px",
          height: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          background: "transparent",
          color: "#788494",
          fontSize: "14px",
          lineHeight: 1,
          cursor: "pointer",
          borderRadius: "4px",
          flexShrink: 0,
        }}
      >
        ⋮
      </button>

      {menuOpen && (
        <div
          style={{
            position: "absolute",
            top: "22px",
            right: 0,
            zIndex: 10,
            minWidth: "120px",
            background: "#1a1f27",
            border: "1px solid #252a32",
            borderRadius: "6px",
            padding: "4px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
          }}
        >
          <button
            type="button"
            style={menuItemStyle}
            onClick={() => {
              onPluginDetails(plugin);
              setMenuOpen(false);
            }}
          >
            Details
          </button>

          <button type="button" style={menuItemStyle} onClick={handleEnable}>
            Enable
          </button>

          <button
            type="button"
            style={menuItemStyle}
            onClick={handleDisable}
          >
            Disable
          </button>

          <div
            style={{
              padding: "6px 10px",
              fontSize: "10px",
              color: "#586373",
            }}
          >
            {isActive ? "Currently active" : "Currently inactive"}
          </div>
        </div>
      )}
    </div>
  );
}

export default PluginActions;