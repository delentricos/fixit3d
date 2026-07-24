import { api } from "../../../api/client";

interface PluginActionsProps {
  pluginId: string;
  onPluginChanged: () => void;
}
function PluginActions({
  pluginId,
  onPluginChanged,
}: PluginActionsProps) {
  async function handleEnable() {
    try {
      await api.enablePlugin(pluginId);

      onPluginChanged();

      console.log("Plugin enabled:", pluginId);
    } catch (error) {
      console.error("Enable failed:", error);
    }
  }

  async function handleDisable() {
  try {
    await api.disablePlugin(pluginId);

    onPluginChanged();

    console.log("Plugin disabled:", pluginId);
  } catch (error) {
    console.error("Disable failed:", error);
  }
}

  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        marginTop: "1rem",
      }}
    >
      <button
        onClick={() => {
          console.log("View plugin:", pluginId);
        }}
      >
        Details
      </button>

      <button onClick={handleEnable}>
        Enable
      </button>

      <button onClick={handleDisable}>
        Disable
      </button>
    </div>
  );
}

export default PluginActions;