import { useState } from "react";
import { api } from "../../api/client";
import type { Part } from "./types";

export type PluginType = "box" | "angle_bracket" | "lid";

interface CreatePartDialogProps {
  isOpen: boolean;
  parts: Part[];
  onClose: () => void;
  onPartCreated: (part: Part) => void;
}

function CreatePartDialog({
  isOpen,
  parts,
  onClose,
  onPartCreated,
}: CreatePartDialogProps) {
  const [selectedPlugin, setSelectedPlugin] =
    useState<PluginType>("box");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Box parameters
  const [boxWidth, setBoxWidth] = useState("200");
  const [boxDepth, setBoxDepth] = useState("150");
  const [boxHeight, setBoxHeight] = useState("100");
  const [boxThickness, setBoxThickness] = useState("5");

  // Angle Bracket parameters
  const [bracketWidth, setBracketWidth] = useState("100");
  const [bracketHeight, setBracketHeight] = useState("80");
  const [bracketThickness, setBracketThickness] = useState("5");
  const [bracketAngle, setBracketAngle] = useState("90");

  // Lid parameters
  const [lidHostId, setLidHostId] = useState<string>("");
  const [lidThickness, setLidThickness] = useState("5");

  function getCompatibleBoxes(): Part[] {
    return parts.filter((p) => p.plugin === "box");
  }

  function validateDimensions(
    width: string,
    depth?: string,
    height?: string
  ): string | null {
    const dims = [width, depth, height].filter((d) => d !== undefined);

    for (const dim of dims) {
      if (!dim || dim.trim() === "") {
        return "All dimensions are required";
      }

      const num = parseFloat(dim);
      if (isNaN(num)) {
        return "Dimensions must be valid numbers";
      }

      if (num <= 0) {
        return "Dimensions must be positive";
      }
    }

    return null;
  }

  function validatePositiveNumber(
    value: string,
    label: string
  ): string | null {
    if (!value || value.trim() === "") {
      return `${label} is required`;
    }

    const number = Number(value);
    if (!Number.isFinite(number)) {
      return `${label} must be a valid number`;
    }

    if (number <= 0) {
      return `${label} must be positive`;
    }

    return null;
  }

  async function handleSubmit() {
    setError(null);

    try {
      let payload: Record<string, any> = {};

      if (selectedPlugin === "box") {
        const dimError = validateDimensions(
          boxWidth,
          boxDepth,
          boxHeight
        );
        if (dimError) {
          setError(dimError);
          return;
        }

        const thicknessError = validatePositiveNumber(
          boxThickness,
          "Thickness"
        );
        if (thicknessError) {
          setError(thicknessError);
          return;
        }

        payload = {
          width: parseFloat(boxWidth),
          depth: parseFloat(boxDepth),
          height: parseFloat(boxHeight),
          thickness: parseFloat(boxThickness),
        };
      } else if (selectedPlugin === "angle_bracket") {
        const dimError = validateDimensions(
          bracketWidth,
          bracketHeight
        );
        if (dimError) {
          setError(dimError);
          return;
        }

        const thicknessError = validatePositiveNumber(
          bracketThickness,
          "Thickness"
        );
        const angleError = validatePositiveNumber(
          bracketAngle,
          "Angle"
        );
        if (thicknessError || angleError) {
          setError(thicknessError ?? angleError);
          return;
        }

        payload = {
          width: parseFloat(bracketWidth),
          height: parseFloat(bracketHeight),
          thickness: parseFloat(bracketThickness),
          angle: parseFloat(bracketAngle),
        };
      } else if (selectedPlugin === "lid") {
        const thicknessError = validatePositiveNumber(
          lidThickness,
          "Thickness"
        );
        if (thicknessError) {
          setError(thicknessError);
          return;
        }

        // Host is optional: an explicit host keeps the existing Box -> Lid
        // workflow, an empty selection bootstraps via any compatible Box
        // (backend requires a host to generate a lid) and immediately
        // detaches it so the Lid ends up independent.
        const hostId = lidHostId || compatibleBoxes[0]?.id;
        const hostBox = parts.find((p) => p.id === hostId);
        if (!hostBox) {
          setError("No Box parts available. Create a Box first.");
          return;
        }

        payload = {
          host_id: hostBox.id,
          width: hostBox.parameters.width,
          depth: hostBox.parameters.depth,
          thickness: parseFloat(lidThickness),
        };
      }

      setIsLoading(true);
      let generatedPart = await api.generatePart(
        selectedPlugin,
        payload
      );

      if (selectedPlugin === "lid" && !lidHostId) {
        generatedPart = await api.detachPart(generatedPart.id);
      }

      setIsLoading(false);
      onPartCreated(generatedPart);
      onClose();

      // Reset form
      setBoxWidth("200");
      setBoxDepth("150");
      setBoxHeight("100");
      setBoxThickness("5");
      setBracketWidth("100");
      setBracketHeight("80");
      setBracketThickness("5");
      setBracketAngle("90");
      setLidHostId("");
      setLidThickness("5");
    } catch (err) {
      setIsLoading(false);
      const message =
        err instanceof Error ? err.message : "Failed to create part";
      setError(message);
    }
  }

  if (!isOpen) {
    return null;
  }

  const compatibleBoxes = getCompatibleBoxes();

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
          maxWidth: "500px",
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
          color: "#e8ecf1",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 24px 0", fontSize: "18px" }}>
          Create Part
        </h2>

        {/* Plugin selector */}
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "#b0b8c3",
              marginBottom: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Part Type
          </label>
          <div
            style={{
              display: "flex",
              gap: "8px",
            }}
          >
            {["box", "angle_bracket", "lid"].map(
              (pluginId: string) => {
                const names: Record<string, string> = {
                  box: "Box",
                  angle_bracket: "Angle Bracket",
                  lid: "Lid",
                };
                return (
                  <button
                    key={pluginId}
                    onClick={() =>
                      setSelectedPlugin(pluginId as PluginType)
                    }
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      border:
                        selectedPlugin === pluginId
                          ? "1px solid #4a8adb"
                          : "1px solid #3a4450",
                      background:
                        selectedPlugin === pluginId
                          ? "#1e3a52"
                          : "#222a32",
                      color:
                        selectedPlugin === pluginId
                          ? "#b0d4f1"
                          : "#8a98a8",
                      borderRadius: "5px",
                      fontSize: "12px",
                      fontWeight: 500,
                      cursor: "pointer",
                      transition:
                        "border-color 0.2s, background 0.2s",
                    }}
                  >
                    {names[pluginId]}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Parameter inputs based on selected plugin */}
        {selectedPlugin === "box" && (
          <div>
            <InputField
              label="Width"
              value={boxWidth}
              onChange={setBoxWidth}
              disabled={isLoading}
            />
            <InputField
              label="Depth"
              value={boxDepth}
              onChange={setBoxDepth}
              disabled={isLoading}
            />
            <InputField
              label="Height"
              value={boxHeight}
              onChange={setBoxHeight}
              disabled={isLoading}
            />
            <InputField
              label="Thickness"
              value={boxThickness}
              onChange={setBoxThickness}
              disabled={isLoading}
            />
          </div>
        )}

        {selectedPlugin === "angle_bracket" && (
          <div>
            <InputField
              label="Width"
              value={bracketWidth}
              onChange={setBracketWidth}
              disabled={isLoading}
            />
            <InputField
              label="Height"
              value={bracketHeight}
              onChange={setBracketHeight}
              disabled={isLoading}
            />
            <InputField
              label="Thickness"
              value={bracketThickness}
              onChange={setBracketThickness}
              disabled={isLoading}
            />
            <InputField
              label="Angle"
              value={bracketAngle}
              onChange={setBracketAngle}
              disabled={isLoading}
            />
          </div>
        )}

        {selectedPlugin === "lid" && (
          <div>
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#b0b8c3",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Host Box (optional)
              </label>
              <select
                value={lidHostId}
                onChange={(e) => setLidHostId(e.target.value)}
                disabled={isLoading}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #3a4450",
                  background: "#222a32",
                  color: "#b0b8c3",
                  borderRadius: "4px",
                  fontSize: "13px",
                }}
              >
                <option value="">No host (create independent Lid)</option>
                {compatibleBoxes.map((box) => (
                  <option key={box.id} value={box.id}>
                    {box.id} (
                    {box.parameters.width}×{box.parameters.depth}×
                    {box.parameters.height})
                  </option>
                ))}
              </select>
              {compatibleBoxes.length === 0 && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#ff9800",
                    marginTop: "6px",
                  }}
                >
                  No Box parts available. Create a Box first.
                </div>
              )}
            </div>
            <InputField
              label="Thickness"
              value={lidThickness}
              onChange={setLidThickness}
              disabled={isLoading}
            />
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            style={{
              background: "#5c2c2c",
              border: "1px solid #ff6b6b",
              borderRadius: "4px",
              padding: "12px",
              fontSize: "12px",
              color: "#ff9999",
              marginBottom: "16px",
              wordWrap: "break-word",
            }}
          >
            {error}
          </div>
        )}

        {/* Buttons */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginTop: "24px",
          }}
        >
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: "10px",
              border: "1px solid #3a4450",
              background: "#222a32",
              color: "#b0b8c3",
              borderRadius: "5px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              isLoading ||
              (selectedPlugin === "lid" && compatibleBoxes.length === 0)
            }
            style={{
              flex: 1,
              padding: "10px",
              border: "1px solid #4a8adb",
              background:
                isLoading || compatibleBoxes.length === 0
                  ? "#1e3a52"
                  : "#2563eb",
              color: "#e0f1ff",
              borderRadius: "5px",
              fontSize: "13px",
              fontWeight: 500,
              cursor:
                isLoading ||
                (selectedPlugin === "lid" && compatibleBoxes.length === 0)
                  ? "not-allowed"
                  : "pointer",
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            {isLoading ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function InputField({
  label,
  value,
  onChange,
  disabled,
}: InputFieldProps) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label
        style={{
          display: "block",
          fontSize: "12px",
          fontWeight: 600,
          color: "#b0b8c3",
          marginBottom: "6px",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        step="0.1"
        style={{
          width: "100%",
          padding: "8px",
          border: "1px solid #3a4450",
          background: "#222a32",
          color: "#b0b8c3",
          borderRadius: "4px",
          fontSize: "13px",
          boxSizing: "border-box",
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : "text",
        }}
      />
    </div>
  );
}

export default CreatePartDialog;
