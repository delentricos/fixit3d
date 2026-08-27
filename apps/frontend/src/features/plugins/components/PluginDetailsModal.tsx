import { Plugin } from "../types";

interface PluginDetailsModalProps {
  plugin: Plugin;
  onClose: () => void;
}

function displayValue(value?: string | null) {
  return value && value.trim().length > 0 ? value : "Not available";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "#7f8998",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "13px", color: "#e8ecf1" }}>{value}</div>
    </div>
  );
}

function PluginDetailsModal({ plugin, onClose }: PluginDetailsModalProps) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1a1f27",
          border: "1px solid #252a32",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "420px",
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
          color: "#e8ecf1",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 20px 0", fontSize: "16px", fontWeight: 600 }}>
          {displayValue(plugin.name)}
        </h2>

        <Field label="ID" value={displayValue(plugin.id)} />
        <Field label="Version" value={displayValue(plugin.version)} />
        <Field label="Status" value={displayValue(plugin.status)} />
        <Field label="Category" value={displayValue(plugin.category)} />
        <Field label="Description" value={displayValue(plugin.description)} />
        <Field label="Author" value={displayValue(plugin.author)} />

        <div style={{ marginBottom: "8px" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "#7f8998",
              marginBottom: "6px",
            }}
          >
            Capabilities
          </div>

          {plugin.capabilities && plugin.capabilities.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
              }}
            >
              {plugin.capabilities.map((capability) => (
                <span
                  key={capability}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "4px",
                    border: "1px solid #3a4450",
                    background: "#222a32",
                    color: "#b0b8c3",
                    fontSize: "11px",
                  }}
                >
                  {capability}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: "13px", color: "#e8ecf1" }}>
              Not available
            </div>
          )}
        </div>

        <div style={{ marginTop: "24px", textAlign: "right" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 14px",
              border: "1px solid #3a4450",
              background: "#222a32",
              color: "#b0b8c3",
              borderRadius: "5px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default PluginDetailsModal;
