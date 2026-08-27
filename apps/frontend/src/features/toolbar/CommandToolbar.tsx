export type ActiveTool =
  | "none"
  | "edit-dimensions"
  | "hole"
  | "plane"
  | "move"
  | "rotate"
  | "scale"
  | "delete"
  | "measure-selected"
  | "measure-between"
  | "snap-grid"
  | "snap-mount"
  | "align-x"
  | "align-y"
  | "align-z"
  | "attach"
  | "detach";

type ToolButtonProps = {
  label: string;
  tool: ActiveTool;
  activeTool: ActiveTool;
  onSelect: (tool: ActiveTool) => void;
  disabled?: boolean;
};

function ToolButton({
  label,
  tool,
  activeTool,
  onSelect,
  disabled,
}: ToolButtonProps) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={() => onSelect(activeTool === tool ? "none" : tool)}
      aria-pressed={activeTool === tool}
      style={{
        border: "1px solid #303844",
        borderRadius: "3px",
        background: activeTool === tool ? "#35506a" : disabled ? "#171b21" : "#202831",
        color: disabled ? "#596372" : "#d8e0e8",
        padding: "5px 8px",
        fontSize: "11px",
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function ToolGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        padding: "0 10px",
        borderRight: "1px solid #303844",
      }}
    >
      <span
        style={{
          color: "#8490a0",
          fontSize: "9px",
          fontWeight: 700,
          letterSpacing: "0.1em",
        }}
      >
        {title}
      </span>
      <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
        {children}
      </div>
    </div>
  );
}

export type CommandToolbarProps = {
  selectedPartCount: number;
  canEditDimensions: boolean;
  activeTool: ActiveTool;
  onToolSelect: (tool: ActiveTool) => void;
};

function CommandToolbar({
  selectedPartCount,
  canEditDimensions,
  activeTool,
  onToolSelect,
}: CommandToolbarProps) {
  return (
    <div
      aria-label="FixIt3D command toolbar"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "stretch",
        gap: "2px",
        minHeight: "58px",
        padding: "8px 10px",
        boxSizing: "border-box",
        overflowX: "auto",
        background: "rgba(17, 20, 25, 0.97)",
        borderBottom: "1px solid #303844",
      }}
    >
      <ToolGroup title="PROPERTIES">
        <ToolButton
          label="Edit Dimensions"
          tool="edit-dimensions"
          activeTool={activeTool}
          onSelect={onToolSelect}
          disabled={selectedPartCount !== 1 || !canEditDimensions}
        />
      </ToolGroup>
      <ToolGroup title="FEATURES">
        <ToolButton
          label="Plane"
          tool="plane"
          activeTool={activeTool}
          onSelect={onToolSelect}
          disabled={selectedPartCount !== 1}
        />
        <ToolButton
          label="Hole"
          tool="hole"
          activeTool={activeTool}
          onSelect={onToolSelect}
          disabled={selectedPartCount !== 1}
        />
      </ToolGroup>
      <ToolGroup title="EDIT">
        <ToolButton
          label="Delete"
          tool="delete"
          activeTool={activeTool}
          onSelect={onToolSelect}
          disabled={selectedPartCount === 0}
        />
      </ToolGroup>
      <ToolGroup title="TRANSFORM">
        <ToolButton label="Move" tool="move" activeTool={activeTool} onSelect={onToolSelect} disabled={selectedPartCount === 0} />
        <ToolButton label="Rotate" tool="rotate" activeTool={activeTool} onSelect={onToolSelect} disabled={selectedPartCount === 0} />
        <ToolButton label="Scale" tool="scale" activeTool={activeTool} onSelect={onToolSelect} disabled={selectedPartCount === 0} />
      </ToolGroup>
      <ToolGroup title="MEASURE">
        <ToolButton label="Measure Selected" tool="measure-selected" activeTool={activeTool} onSelect={onToolSelect} disabled={selectedPartCount !== 1} />
        <ToolButton label="Measure Between" tool="measure-between" activeTool={activeTool} onSelect={onToolSelect} disabled={selectedPartCount !== 2} />
      </ToolGroup>
      <ToolGroup title="SNAP & ALIGN">
        <ToolButton label="Snap Grid" tool="snap-grid" activeTool={activeTool} onSelect={onToolSelect} disabled={selectedPartCount === 0} />
        <ToolButton label="Snap to Mount" tool="snap-mount" activeTool={activeTool} onSelect={onToolSelect} disabled={selectedPartCount !== 1} />
        <ToolButton label="Align X" tool="align-x" activeTool={activeTool} onSelect={onToolSelect} disabled={selectedPartCount < 2} />
        <ToolButton label="Align Y" tool="align-y" activeTool={activeTool} onSelect={onToolSelect} disabled={selectedPartCount < 2} />
        <ToolButton label="Align Z" tool="align-z" activeTool={activeTool} onSelect={onToolSelect} disabled={selectedPartCount < 2} />
      </ToolGroup>
      <ToolGroup title="ASSEMBLY">
        <ToolButton label="Attach" tool="attach" activeTool={activeTool} onSelect={onToolSelect} disabled={selectedPartCount !== 1} />
        <ToolButton label="Detach" tool="detach" activeTool={activeTool} onSelect={onToolSelect} disabled={selectedPartCount !== 1} />
      </ToolGroup>
    </div>
  );
}

export default CommandToolbar;
