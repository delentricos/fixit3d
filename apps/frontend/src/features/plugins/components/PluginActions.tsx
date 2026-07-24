interface PluginActionsProps {
  pluginId: string;
}

function PluginActions({ pluginId }: PluginActionsProps) {
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

      <button
        onClick={() => {
          console.log("Disable plugin:", pluginId);
        }}
      >
        Disable
      </button>
    </div>
  );
}

export default PluginActions;