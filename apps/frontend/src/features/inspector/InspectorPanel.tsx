import { useEffect, useState, type ReactNode } from "react";
import { api } from "../../api/client";
import type { CompatibleHost, Part } from "../parts/types";
import { useSelectionStore } from "../../shared/state/selectionStore";
import {
  getPartPosition,
  getPartRotation,
  getPartScale,
  getMountPosition,
} from "../viewer/partPosition";
import type { MeasurementResult } from "../viewer/measurement";
import type { ActiveTool } from "../toolbar/CommandToolbar";

function prettyName(plugin: string) {
  if (plugin === "box") return "Box";
  if (plugin === "lid") return "Lid";
  if (plugin === "angle_bracket") return "Angle Bracket";
  return plugin.replace(/_/g, " ");
}

function prettyParameter(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function InspectorAccordion({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <section
      style={{
        marginBottom: "12px",
        borderBottom: "1px solid #292f38",
        paddingBottom: "12px",
      }}
    >
      <div
        style={{
          cursor: "pointer",
          listStyle: "none",
          color: "#f2f4f7",
          fontSize: "12px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          padding: "4px 0 10px",
          userSelect: "none",
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

interface InspectorPanelProps {
  parts: Part[];
  snapGrid: string;
  onSnapGridChange: (value: string) => void;
  measurement: MeasurementResult | null;
  onMeasure: (partId: string) => void;
  onMeasureBetween: (partIds: [string, string]) => void;
  activeTool: ActiveTool;
  onToolCancel: () => void;
  onPartUpdated?: () => void | Promise<unknown>;
}

function InspectorPanel({
  parts,
  snapGrid,
  onSnapGridChange,
  measurement,
  onMeasure,
  onMeasureBetween,
  activeTool,
  onToolCancel,
  onPartUpdated,
}: InspectorPanelProps) {
  const selectedPartIds = useSelectionStore(
    (state) => state.selectedPartIds
  );
  const selectedPartId = useSelectionStore(
    (state) => state.selectedPartId
  );

  const part = parts.find((item) => item.id === selectedPartId);

  const parent = part?.features.attached_to
    ? parts.find(
        (item) =>
          item.id === part.features.attached_to?.part_id
      )
    : undefined;

  // State for Box dimension editing
  const [editWidth, setEditWidth] = useState<string>("");
  const [editDepth, setEditDepth] = useState<string>("");
  const [editHeight, setEditHeight] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingDimensions, setIsEditingDimensions] = useState(false);
  const [compatibleHosts, setCompatibleHosts] = useState<CompatibleHost[]>([]);
  const [isAttachDialogOpen, setIsAttachDialogOpen] = useState(false);
  const [isRelationLoading, setIsRelationLoading] = useState(false);
  const [relationError, setRelationError] = useState<string | null>(null);
  const [selectedHostKey, setSelectedHostKey] = useState("");
  const [moveX, setMoveX] = useState("0");
  const [moveY, setMoveY] = useState("0");
  const [moveZ, setMoveZ] = useState("0");
  const [isMoving, setIsMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [rotateX, setRotateX] = useState("0");
  const [rotateY, setRotateY] = useState("0");
  const [rotateZ, setRotateZ] = useState("0");
  const [isRotating, setIsRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [scaleX, setScaleX] = useState("1");
  const [scaleY, setScaleY] = useState("1");
  const [scaleZ, setScaleZ] = useState("1");
  const [isScaling, setIsScaling] = useState(false);
  const [scaleError, setScaleError] = useState<string | null>(null);
  const [isSnapping, setIsSnapping] = useState(false);
  const [snapError, setSnapError] = useState<string | null>(null);
  const [assemblyHosts, setAssemblyHosts] = useState<CompatibleHost[]>([]);
  const [isAssemblyLoading, setIsAssemblyLoading] = useState(false);
  const [assemblyError, setAssemblyError] = useState<string | null>(null);
  const [isAligning, setIsAligning] = useState(false);
  const [alignError, setAlignError] = useState<string | null>(null);

  const isBox = part?.plugin === "box";

  const partIndex = part
    ? parts.findIndex((item) => item.id === part.id)
    : -1;
  const currentPosition = part
    ? getPartPosition(part, partIndex, parts)
    : null;

  useEffect(() => {
    let cancelled = false;

    if (selectedPartIds.length !== 1) {
      setAssemblyHosts([]);
      setAssemblyError(null);
      setIsAssemblyLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsAssemblyLoading(true);
    setAssemblyError(null);

    api.compatibleHosts(selectedPartIds[0])
      .then((response) => {
        if (!cancelled) setAssemblyHosts(response.hosts);
      })
      .catch(() => {
        if (!cancelled) {
          setAssemblyHosts([]);
          setAssemblyError("Unable to find a compatible mount");
        }
      })
      .finally(() => {
        if (!cancelled) setIsAssemblyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPartIds]);

  useEffect(() => {
    if (activeTool !== "edit-dimensions" || !part || !isBox) return;

    handleStartEditDimensions();
  }, [activeTool, part, isBox]);

  const handleResetMove = () => {
    setMoveX("0");
    setMoveY("0");
    setMoveZ("0");
    setMoveError(null);
  };

  const handleResetRotate = () => {
    setRotateX("0");
    setRotateY("0");
    setRotateZ("0");
    setRotateError(null);
  };

  const handleResetScale = () => {
    setScaleX("1");
    setScaleY("1");
    setScaleZ("1");
    setScaleError(null);
  };

  const handleSnap = async () => {
    if (selectedPartIds.length === 0) return;

    const trimmedGrid = snapGrid.trim();
    const grid = trimmedGrid === "" ? NaN : Number(trimmedGrid);

    if (!Number.isFinite(grid) || grid <= 0) {
      setSnapError("Grid must be a finite number greater than zero");
      return;
    }

    const updates = selectedPartIds.map((partId) => {
      const selectedPart = parts.find((item) => item.id === partId);
      if (!selectedPart) return null;

      const selectedIndex = parts.findIndex(
        (item) => item.id === selectedPart.id
      );
      const position = getPartPosition(
        selectedPart,
        selectedIndex,
        parts
      );

      return {
        id: selectedPart.id,
        position: {
          x: Math.round(position.x / grid) * grid,
          y: Math.round(position.y / grid) * grid,
          z: Math.round(position.z / grid) * grid,
        },
      };
    }).filter((update): update is NonNullable<typeof update> => update !== null);

    if (updates.length === 0) return;

    setIsSnapping(true);
    setSnapError(null);

    try {
      await api.updatePartTransforms(updates);
      await onPartUpdated?.();
    } catch (err) {
      setSnapError(
        err instanceof Error ? err.message : "Failed to snap parts"
      );
    } finally {
      setIsSnapping(false);
    }
  };

  const handleAssemblySnap = async () => {
    if (
      selectedPartIds.length !== 1 ||
      assemblyHosts.length === 0 ||
      !part
    ) {
      return;
    }

    const destination = assemblyHosts[0];
    const destinationIndex = parts.findIndex(
      (item) => item.id === destination.part.id
    );
    const destinationPartPosition = getPartPosition(
      destination.part,
      destinationIndex,
      parts
    );
    const destinationPosition = getMountPosition(
      destination.part,
      destination.mount_id,
      part,
      destinationPartPosition
    );

    if (!destinationPosition) {
      setAssemblyError("The compatible mount has no valid position");
      return;
    }

    setIsAssemblyLoading(true);
    setAssemblyError(null);

    try {
      await api.updatePartTransforms([
        {
          id: part.id,
          position: destinationPosition,
        },
      ]);
      await onPartUpdated?.();
    } catch (err) {
      setAssemblyError(
        err instanceof Error
          ? err.message
          : "Failed to snap part to mount"
      );
    } finally {
      setIsAssemblyLoading(false);
    }
  };

  const handleAlign = async (axis: "x" | "y" | "z") => {
    if (
      selectedPartIds.length < 2 ||
      !selectedPartId ||
      !selectedPartIds.includes(selectedPartId)
    ) {
      return;
    }

    const primaryPart = parts.find(
      (item) => item.id === selectedPartId
    );
    if (!primaryPart) return;

    const primaryIndex = parts.findIndex(
      (item) => item.id === primaryPart.id
    );
    const primaryPosition = getPartPosition(
      primaryPart,
      primaryIndex,
      parts
    );

    const updates = selectedPartIds.map((partId) => {
      if (partId === selectedPartId) return null;

      const selectedPart = parts.find((item) => item.id === partId);
      if (!selectedPart) return null;

      const selectedIndex = parts.findIndex(
        (item) => item.id === selectedPart.id
      );
      const position = getPartPosition(
        selectedPart,
        selectedIndex,
        parts
      );

      return {
        id: selectedPart.id,
        position: {
          ...position,
          [axis]: primaryPosition[axis],
        },
      };
    }).filter((update): update is NonNullable<typeof update> => update !== null);

    if (updates.length === 0) return;

    setIsAligning(true);
    setAlignError(null);

    try {
      await api.updatePartTransforms(updates);
      await onPartUpdated?.();
    } catch (err) {
      setAlignError(
        err instanceof Error ? err.message : "Failed to align parts"
      );
    } finally {
      setIsAligning(false);
    }
  };

  const handleMove = async () => {
    if (selectedPartIds.length === 0) return;

    const delta = [moveX, moveY, moveZ].map((value) => {
      const trimmed = value.trim();
      return trimmed === "" ? 0 : Number(trimmed);
    });

    if (delta.some((value) => !Number.isFinite(value))) {
      setMoveError("Move values must be finite numbers");
      return;
    }

    const updates = selectedPartIds.map((partId) => {
      const selectedPart = parts.find((item) => item.id === partId);
      if (!selectedPart) return null;

      const selectedIndex = parts.findIndex(
        (item) => item.id === selectedPart.id
      );
      const position = getPartPosition(
        selectedPart,
        selectedIndex,
        parts
      );

      return {
        id: selectedPart.id,
        position: {
          x: position.x + delta[0],
          y: position.y + delta[1],
          z: position.z + delta[2],
        },
      };
    }).filter((update): update is NonNullable<typeof update> => update !== null);

    if (updates.length === 0) return;

    setIsMoving(true);
    setMoveError(null);

    try {
      await api.moveParts(updates);
      await onPartUpdated?.();
    } catch (err) {
      setMoveError(
        err instanceof Error ? err.message : "Failed to move parts"
      );
    } finally {
      setIsMoving(false);
    }
  };

  const handleRotate = async () => {
    if (selectedPartIds.length === 0) return;

    const delta = [rotateX, rotateY, rotateZ].map((value) => {
      const trimmed = value.trim();
      return trimmed === "" ? 0 : Number(trimmed);
    });

    if (delta.some((value) => !Number.isFinite(value))) {
      setRotateError("Rotate values must be finite numbers");
      return;
    }

    const updates = selectedPartIds.map((partId) => {
      const selectedPart = parts.find((item) => item.id === partId);
      if (!selectedPart) return null;

      const rotation = getPartRotation(selectedPart);

      return {
        id: selectedPart.id,
        rotation: {
          x: rotation.x + delta[0],
          y: rotation.y + delta[1],
          z: rotation.z + delta[2],
        },
      };
    }).filter((update): update is NonNullable<typeof update> => update !== null);

    if (updates.length === 0) return;

    setIsRotating(true);
    setRotateError(null);

    try {
      await api.updatePartTransforms(updates);
      await onPartUpdated?.();
    } catch (err) {
      setRotateError(
        err instanceof Error ? err.message : "Failed to rotate parts"
      );
    } finally {
      setIsRotating(false);
    }
  };

  const handleScale = async () => {
    if (selectedPartIds.length === 0) return;

    const factors = [scaleX, scaleY, scaleZ].map((value) => {
      const trimmed = value.trim();
      return trimmed === "" ? 1 : Number(trimmed);
    });

    if (
      factors.some(
        (value) => !Number.isFinite(value) || value <= 0
      )
    ) {
      setScaleError("Scale factors must be finite numbers greater than zero");
      return;
    }

    const updates = selectedPartIds.map((partId) => {
      const selectedPart = parts.find((item) => item.id === partId);
      if (!selectedPart) return null;

      const scale = getPartScale(selectedPart);

      return {
        id: selectedPart.id,
        scale: {
          x: scale.x * factors[0],
          y: scale.y * factors[1],
          z: scale.z * factors[2],
        },
      };
    }).filter((update): update is NonNullable<typeof update> => update !== null);

    if (updates.length === 0) return;

    setIsScaling(true);
    setScaleError(null);

    try {
      await api.updatePartTransforms(updates);
      await onPartUpdated?.();
    } catch (err) {
      setScaleError(
        err instanceof Error ? err.message : "Failed to scale parts"
      );
    } finally {
      setIsScaling(false);
    }
  };

  const boundingBoxMeasurement =
    measurement && "width" in measurement
      ? measurement
      : null;
  const betweenPartsMeasurement =
    measurement && "distance" in measurement
      ? measurement
      : null;

  const handleOpenAttachDialog = async () => {
    if (!part) return;

    setIsAttachDialogOpen(true);
    setIsRelationLoading(true);
    setRelationError(null);
    setSelectedHostKey("");

    try {
      const response = await api.compatibleHosts(part.id);
      setCompatibleHosts(response.hosts);
    } catch (err) {
      setCompatibleHosts([]);
      setRelationError(
        err instanceof Error
          ? err.message
          : "Failed to load compatible hosts"
      );
    } finally {
      setIsRelationLoading(false);
    }
  };

  const handleCloseAttachDialog = () => {
    if (isRelationLoading) return;

    setIsAttachDialogOpen(false);
    setRelationError(null);
    setSelectedHostKey("");
  };

  const handleAttach = async () => {
    if (!part || !selectedHostKey) {
      setRelationError("Select a compatible host and mount");
      return;
    }

    const selectedHost = compatibleHosts.find(
      (item) =>
        `${item.part.id}:${item.mount_id}:${item.connection_type}` ===
        selectedHostKey
    );

    if (!selectedHost) {
      setRelationError("Selected host is no longer available");
      return;
    }

    setIsRelationLoading(true);
    setRelationError(null);

    try {
      await api.attachPart(
        part.id,
        selectedHost.part.id,
        selectedHost.mount_id,
        selectedHost.connection_type
      );
      await onPartUpdated?.();
      setIsAttachDialogOpen(false);
      setSelectedHostKey("");
    } catch (err) {
      setRelationError(
        err instanceof Error ? err.message : "Failed to attach part"
      );
    } finally {
      setIsRelationLoading(false);
    }
  };

  const handleDetach = async () => {
    if (!part) return;

    setIsRelationLoading(true);
    setRelationError(null);

    try {
      await api.detachPart(part.id);
      await onPartUpdated?.();
    } catch (err) {
      setRelationError(
        err instanceof Error ? err.message : "Failed to detach part"
      );
    } finally {
      setIsRelationLoading(false);
    }
  };

  const handleStartEditDimensions = () => {
    if (part) {
      setEditWidth(String(part.parameters.width || ""));
      setEditDepth(String(part.parameters.depth || ""));
      setEditHeight(String(part.parameters.height || ""));
      setIsEditingDimensions(true);
      setError(null);
    }
  };

  const handleCancelEditDimensions = () => {
    setIsEditingDimensions(false);
    setError(null);
    onToolCancel();
  };

  const handleApplyDimensions = async () => {
    if (!part || !isBox) return;

    setIsLoading(true);
    setError(null);

    try {
      const width = parseFloat(editWidth);
      const depth = parseFloat(editDepth);
      const height = parseFloat(editHeight);

      if (isNaN(width) || isNaN(depth) || isNaN(height)) {
        setError("All dimensions must be valid numbers");
        setIsLoading(false);
        return;
      }

      if (width <= 0 || depth <= 0 || height <= 0) {
        setError("All dimensions must be positive");
        setIsLoading(false);
        return;
      }

      // Call backend to update box dimensions
      await api.executePlugin("box", "set_dimensions", {
        id: part.id,
        width,
        depth,
        height,
      });

      // Refresh all parts from backend after successful update
      if (onPartUpdated) {
        onPartUpdated();
      }

      setIsEditingDimensions(false);
      onToolCancel();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update dimensions"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        background: "#15181e",
        color: "#cbd2dc",
        overflowY: "auto",
        padding: "18px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "#687384",
          marginBottom: "18px",
        }}
      >
        Inspector
      </div>

      {!part ? (
        <div
          style={{
            color: "#667080",
            fontSize: "13px",
            lineHeight: 1.6,
            paddingTop: "8px",
          }}
        >
          Select a part to see its properties.
        </div>
      ) : (
        <>
          {/* Header */}
          <div
            style={{
              paddingBottom: "18px",
              marginBottom: "18px",
              borderBottom: "1px solid #292f38",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "7px",
              }}
            >
              <div
                style={{
                  color: "#f2f4f7",
                  fontSize: "18px",
                  fontWeight: 600,
                }}
              >
                {prettyName(part.plugin)}
              </div>

              <span
                style={{
                  padding: "3px 7px",
                  borderRadius: "4px",
                  background: "#202b3a",
                  border: "1px solid #34465d",
                  color: "#91a9c6",
                  fontSize: "9px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {part.plugin}
              </span>
            </div>

            <div
              style={{
                color: "#667080",
                fontSize: "11px",
                fontFamily: "monospace",
              }}
            >
              {part.id}
            </div>
          </div>
          {(activeTool === "move" || activeTool === "rotate" || activeTool === "scale") && <InspectorAccordion title="Transform">
          <section
            style={{
              marginBottom: "24px",
              paddingBottom: "18px",
              borderBottom: "1px solid #292f38",
            }}
          >
            <div
              style={{
                color: "#8c96a5",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "10px",
              }}
            >
              Transform
            </div>

            {activeTool === "move" && <>
            <div
              style={{
                color: "#cbd2dc",
                fontSize: "12px",
                marginBottom: "10px",
              }}
            >
              Move Δ
              <span style={{ color: "#667080", marginLeft: "6px" }}>
                {selectedPartIds.length > 1
                  ? `${selectedPartIds.length} parts`
                  : "offset"}
              </span>
            </div>

            {(["X", "Y", "Z"] as const).map((axis) => {
              const value = axis === "X" ? moveX : axis === "Y" ? moveY : moveZ;
              const setValue = axis === "X" ? setMoveX : axis === "Y" ? setMoveY : setMoveZ;

              return (
                <label
                  key={axis}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "20px 1fr",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "7px",
                    color: "#8993a2",
                    fontSize: "11px",
                  }}
                >
                  {axis}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    disabled={isMoving}
                    aria-label={`Move ${axis}`}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "6px 7px",
                      background: "#0f1115",
                      color: "#e1e5ea",
                      border: "1px solid #303844",
                      borderRadius: "3px",
                      fontSize: "12px",
                      fontFamily: "monospace",
                    }}
                  />
                </label>
              );
            })}

            {currentPosition && (
              <div
                style={{
                  color: "#667080",
                  fontSize: "10px",
                  fontFamily: "monospace",
                  margin: "10px 0",
                }}
              >
                Position {currentPosition.x.toFixed(2)}, {currentPosition.y.toFixed(2)}, {currentPosition.z.toFixed(2)}
              </div>
            )}

            {moveError && (
              <div
                style={{
                  color: "#ff8b8b",
                  fontSize: "11px",
                  marginBottom: "8px",
                }}
              >
                {moveError}
              </div>
            )}

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={handleMove}
                id="tool-move-apply"
                disabled={isMoving}
                style={{
                  flex: 1,
                  padding: "7px",
                  background: "#2a5a3a",
                  color: "#b8e6c8",
                  border: "1px solid #3d7a4f",
                  borderRadius: "3px",
                  fontSize: "11px",
                  cursor: isMoving ? "not-allowed" : "pointer",
                  opacity: isMoving ? 0.6 : 1,
                }}
              >
                {isMoving ? "Applying..." : "Apply"}
              </button>
              <button
                type="button"
                onClick={handleResetMove}
                disabled={isMoving}
                style={{
                  padding: "7px 10px",
                  background: "#3a3a3a",
                  color: "#b9c1cc",
                  border: "1px solid #4a4a4a",
                  borderRadius: "3px",
                  fontSize: "11px",
                  cursor: isMoving ? "not-allowed" : "pointer",
                  opacity: isMoving ? 0.6 : 1,
                }}
              >
                Reset
              </button>
            </div>

            <div
              style={{
                height: "1px",
                background: "#292f38",
                margin: "16px 0",
              }}
            />
            </>}

            {activeTool === "rotate" && <>
            <div
              style={{
                color: "#cbd2dc",
                fontSize: "12px",
                marginBottom: "10px",
              }}
            >
              Rotate
              <span style={{ color: "#667080", marginLeft: "6px" }}>
                degrees °
              </span>
            </div>

            {(["X", "Y", "Z"] as const).map((axis) => {
              const value = axis === "X" ? rotateX : axis === "Y" ? rotateY : rotateZ;
              const setValue = axis === "X" ? setRotateX : axis === "Y" ? setRotateY : setRotateZ;

              return (
                <label
                  key={axis}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "20px 1fr auto",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "7px",
                    color: "#8993a2",
                    fontSize: "11px",
                  }}
                >
                  {axis}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    disabled={isRotating}
                    aria-label={`Rotate ${axis}`}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "6px 7px",
                      background: "#0f1115",
                      color: "#e1e5ea",
                      border: "1px solid #303844",
                      borderRadius: "3px",
                      fontSize: "12px",
                      fontFamily: "monospace",
                    }}
                  />
                  <span style={{ color: "#667080" }}>°</span>
                </label>
              );
            })}

            {rotateError && (
              <div
                style={{
                  color: "#ff8b8b",
                  fontSize: "11px",
                  marginBottom: "8px",
                }}
              >
                {rotateError}
              </div>
            )}

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={handleRotate}
                id="tool-rotate-apply"
                disabled={isRotating}
                style={{
                  flex: 1,
                  padding: "7px",
                  background: "#2a5a3a",
                  color: "#b8e6c8",
                  border: "1px solid #3d7a4f",
                  borderRadius: "3px",
                  fontSize: "11px",
                  cursor: isRotating ? "not-allowed" : "pointer",
                  opacity: isRotating ? 0.6 : 1,
                }}
              >
                {isRotating ? "Applying..." : "Apply"}
              </button>
              <button
                type="button"
                onClick={handleResetRotate}
                disabled={isRotating}
                style={{
                  padding: "7px 10px",
                  background: "#3a3a3a",
                  color: "#b9c1cc",
                  border: "1px solid #4a4a4a",
                  borderRadius: "3px",
                  fontSize: "11px",
                  cursor: isRotating ? "not-allowed" : "pointer",
                  opacity: isRotating ? 0.6 : 1,
                }}
              >
                Reset
              </button>
            </div>
            </>}

            <div
              style={{
                height: "1px",
                background: "#292f38",
                margin: "16px 0",
              }}
            />

            {activeTool === "scale" && <>
            <div
              style={{
                color: "#cbd2dc",
                fontSize: "12px",
                marginBottom: "10px",
              }}
            >
              Scale
              <span style={{ color: "#667080", marginLeft: "6px" }}>
                factors
              </span>
            </div>

            {(["X", "Y", "Z"] as const).map((axis) => {
              const value = axis === "X" ? scaleX : axis === "Y" ? scaleY : scaleZ;
              const setValue = axis === "X" ? setScaleX : axis === "Y" ? setScaleY : setScaleZ;

              return (
                <label
                  key={axis}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "20px 1fr",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "7px",
                    color: "#8993a2",
                    fontSize: "11px",
                  }}
                >
                  {axis}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    disabled={isScaling}
                    aria-label={`Scale ${axis}`}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "6px 7px",
                      background: "#0f1115",
                      color: "#e1e5ea",
                      border: "1px solid #303844",
                      borderRadius: "3px",
                      fontSize: "12px",
                      fontFamily: "monospace",
                    }}
                  />
                </label>
              );
            })}

            {scaleError && (
              <div
                style={{
                  color: "#ff8b8b",
                  fontSize: "11px",
                  marginBottom: "8px",
                }}
              >
                {scaleError}
              </div>
            )}

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={handleScale}
                id="tool-scale-apply"
                disabled={isScaling}
                style={{
                  flex: 1,
                  padding: "7px",
                  background: "#2a5a3a",
                  color: "#b8e6c8",
                  border: "1px solid #3d7a4f",
                  borderRadius: "3px",
                  fontSize: "11px",
                  cursor: isScaling ? "not-allowed" : "pointer",
                  opacity: isScaling ? 0.6 : 1,
                }}
              >
                {isScaling ? "Applying..." : "Apply"}
              </button>
              <button
                type="button"
                onClick={handleResetScale}
                disabled={isScaling}
                style={{
                  padding: "7px 10px",
                  background: "#3a3a3a",
                  color: "#b9c1cc",
                  border: "1px solid #4a4a4a",
                  borderRadius: "3px",
                  fontSize: "11px",
                  cursor: isScaling ? "not-allowed" : "pointer",
                  opacity: isScaling ? 0.6 : 1,
                }}
              >
                Reset
              </button>
            </div>
            </>}
          </section>
          </InspectorAccordion>}

          {(activeTool === "snap-grid" || activeTool === "snap-mount" || activeTool === "align-x" || activeTool === "align-y" || activeTool === "align-z") && <InspectorAccordion title="Snap & Align">
          {activeTool === "snap-grid" && (
          <section
            style={{
              marginBottom: "24px",
              paddingBottom: "18px",
              borderBottom: "1px solid #292f38",
            }}
          >
            <div
              style={{
                color: "#8c96a5",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "10px",
              }}
            >
              Snap
            </div>

            <label
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr",
                alignItems: "center",
                gap: "8px",
                marginBottom: "10px",
                color: "#8993a2",
                fontSize: "11px",
              }}
            >
              Grid
              <input
                type="text"
                inputMode="decimal"
                value={snapGrid}
                onChange={(event) => onSnapGridChange(event.target.value)}
                disabled={isSnapping}
                aria-label="Snap grid"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "6px 7px",
                  background: "#0f1115",
                  color: "#e1e5ea",
                  border: "1px solid #303844",
                  borderRadius: "3px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                }}
              />
            </label>

            {snapError && (
              <div
                style={{
                  color: "#ff8b8b",
                  fontSize: "11px",
                  marginBottom: "8px",
                }}
              >
                {snapError}
              </div>
            )}

            <button
              type="button"
              onClick={handleSnap}
              id="tool-snap-grid"
              disabled={selectedPartIds.length === 0 || isSnapping}
              style={{
                width: "100%",
                padding: "7px",
                background: "#2a5a3a",
                color: "#b8e6c8",
                border: "1px solid #3d7a4f",
                borderRadius: "3px",
                fontSize: "11px",
                cursor:
                  selectedPartIds.length === 0 || isSnapping
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  selectedPartIds.length === 0 || isSnapping ? 0.6 : 1,
              }}
            >
              {isSnapping ? "Snapping..." : "Snap"}
            </button>
          </section>
          )}

          {activeTool === "snap-mount" && (
          <section
            style={{
              marginBottom: "24px",
              paddingBottom: "18px",
              borderBottom: "1px solid #292f38",
            }}
          >
            <div
              style={{
                color: "#8c96a5",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "10px",
              }}
            >
              Assembly
            </div>

            {selectedPartIds.length > 1 && (
              <div
                style={{
                  color: "#667080",
                  fontSize: "11px",
                  marginBottom: "8px",
                }}
              >
                Select one part to snap to a mount.
              </div>
            )}

            {assemblyError && selectedPartIds.length <= 1 && (
              <div
                style={{
                  color: "#ff8b8b",
                  fontSize: "11px",
                  marginBottom: "8px",
                }}
              >
                {assemblyError}
              </div>
            )}

            {selectedPartIds.length === 1 &&
              !isAssemblyLoading &&
              assemblyHosts.length > 1 && (
                <div
                  style={{
                    color: "#667080",
                    fontSize: "11px",
                    marginBottom: "8px",
                  }}
                >
                  Multiple compatible mounts found; using the first one.
                </div>
              )}

            <button
              type="button"
              onClick={handleAssemblySnap}
              id="tool-snap-mount"
              disabled={
                selectedPartIds.length !== 1 ||
                assemblyHosts.length === 0 ||
                isAssemblyLoading
              }
              style={{
                width: "100%",
                padding: "7px",
                background: "#2a3f54",
                color: "#a8c5dd",
                border: "1px solid #3d5d83",
                borderRadius: "3px",
                fontSize: "11px",
                cursor:
                  selectedPartIds.length !== 1 ||
                  assemblyHosts.length === 0 ||
                  isAssemblyLoading
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  selectedPartIds.length !== 1 ||
                  assemblyHosts.length === 0 ||
                  isAssemblyLoading
                    ? 0.6
                    : 1,
              }}
            >
              {isAssemblyLoading ? "Loading..." : "Snap to Mount"}
            </button>
          </section>
          )}

          {(activeTool === "align-x" || activeTool === "align-y" || activeTool === "align-z") && (
          <section
            style={{
              marginBottom: "24px",
              paddingBottom: "18px",
              borderBottom: "1px solid #292f38",
            }}
          >
            <div
              style={{
                color: "#8c96a5",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "10px",
              }}
            >
              Align
            </div>

            {alignError && (
              <div
                style={{
                  color: "#ff8b8b",
                  fontSize: "11px",
                  marginBottom: "8px",
                }}
              >
                {alignError}
              </div>
            )}

            <div style={{ display: "flex", gap: "8px" }}>
              {(["x", "y", "z"] as const).map((axis) => {
                const disabled = selectedPartIds.length < 2 || isAligning;

                return (
                  <button
                    key={axis}
                    type="button"
                    onClick={() => handleAlign(axis)}
                    id={`tool-align-${axis}`}
                    disabled={disabled}
                    style={{
                      flex: 1,
                      padding: "7px",
                      background: "#2a3f54",
                      color: "#a8c5dd",
                      border: "1px solid #3d5d83",
                      borderRadius: "3px",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.6 : 1,
                    }}
                  >
                    {axis}
                  </button>
                );
              })}
            </div>
          </section>
          )}

          </InspectorAccordion>}

          {(activeTool === "measure-selected" || activeTool === "measure-between") && <InspectorAccordion title="Measure">
          <section
            style={{
              marginBottom: "24px",
              paddingBottom: "18px",
              borderBottom: "1px solid #292f38",
            }}
          >
            <div
              style={{
                color: "#8c96a5",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "10px",
              }}
            >
              Measure
            </div>

            <button
              type="button"
              onClick={() => selectedPartId && onMeasure(selectedPartId)}
              id="tool-measure-selected"
              disabled={selectedPartIds.length !== 1}
              style={{
                width: "100%",
                padding: "7px",
                background: "#2a3f54",
                color: "#a8c5dd",
                border: "1px solid #3d5d83",
                borderRadius: "3px",
                fontSize: "11px",
                cursor: selectedPartIds.length !== 1 ? "not-allowed" : "pointer",
                opacity: selectedPartIds.length !== 1 ? 0.6 : 1,
              }}
            >
              Measure Selected
            </button>

            {activeTool === "measure-between" && <button
              type="button"
              onClick={() => {
                if (selectedPartIds.length === 2) {
                  onMeasureBetween([
                    selectedPartIds[0],
                    selectedPartIds[1],
                  ]);
                }
              }}
              id="tool-measure-between"
              disabled={selectedPartIds.length !== 2}
              style={{
                width: "100%",
                marginTop: "8px",
                padding: "7px",
                background: "#2a3f54",
                color: "#a8c5dd",
                border: "1px solid #3d5d83",
                borderRadius: "3px",
                fontSize: "11px",
                cursor: selectedPartIds.length !== 2 ? "not-allowed" : "pointer",
                opacity: selectedPartIds.length !== 2 ? 0.6 : 1,
              }}
            >
              Measure Between
            </button>}

            {activeTool === "measure-selected" && boundingBoxMeasurement &&
              boundingBoxMeasurement.target.partId === selectedPartId && (
              <div
                style={{
                  marginTop: "10px",
                  border: "1px solid #292f38",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                {([
                  ["Width X", boundingBoxMeasurement.width],
                  ["Height Y", boundingBoxMeasurement.height],
                  ["Depth Z", boundingBoxMeasurement.depth],
                ] as const).map(([label, value], index) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "7px 9px",
                      background: index % 2 === 0 ? "#181c22" : "#15191f",
                      borderBottom: index === 2 ? "none" : "1px solid #242a32",
                      color: "#8993a2",
                      fontSize: "11px",
                    }}
                  >
                    <span>{label}</span>
                    <span style={{ color: "#e1e5ea", fontFamily: "monospace" }}>
                      {value.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activeTool === "measure-between" && betweenPartsMeasurement && (
              <div
                style={{
                  marginTop: "10px",
                  border: "1px solid #292f38",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                {([
                  ["Distance", betweenPartsMeasurement.distance],
                  ["ΔX", betweenPartsMeasurement.deltaX],
                  ["ΔY", betweenPartsMeasurement.deltaY],
                  ["ΔZ", betweenPartsMeasurement.deltaZ],
                ] as const).map(([label, value], index, values) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "7px 9px",
                      background: index % 2 === 0 ? "#181c22" : "#15191f",
                      borderBottom: index === values.length - 1 ? "none" : "1px solid #242a32",
                      color: "#8993a2",
                      fontSize: "11px",
                    }}
                  >
                    <span>{label}</span>
                    <span style={{ color: "#e1e5ea", fontFamily: "monospace" }}>
                      {value.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
          </InspectorAccordion>}

          {/* Parameters / Dimensions Editing */}
          {(activeTool === "none" || activeTool === "edit-dimensions") && <InspectorAccordion title="Properties">
          <section style={{ marginBottom: "24px" }}>
            <div
              style={{
                color: "#8c96a5",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                {activeTool === "edit-dimensions"
                  ? "Edit Dimensions"
                  : "Parameters"}
              </span>
              {activeTool === "none" && isBox && !isEditingDimensions && (
                <button
                  onClick={handleStartEditDimensions}
                  disabled={isLoading}
                  style={{
                    padding: "4px 8px",
                    fontSize: "10px",
                    background: "#2a3f54",
                    color: "#a8c5dd",
                    border: "1px solid #3d5d83",
                    borderRadius: "3px",
                    cursor: isLoading ? "not-allowed" : "pointer",
                    opacity: isLoading ? 0.6 : 1,
                  }}
                >
                  Edit
                </button>
              )}
            </div>

            {activeTool === "edit-dimensions" && isBox ? (
              <div
                style={{
                  border: "1px solid #2a3f54",
                  borderRadius: "6px",
                  padding: "12px",
                  background: "#1a2028",
                }}
              >
                {/* Error message */}
                {error && (
                  <div
                    style={{
                      padding: "8px",
                      marginBottom: "12px",
                      background: "#3d1f1f",
                      border: "1px solid #6b3a3a",
                      borderRadius: "4px",
                      color: "#ff8b8b",
                      fontSize: "12px",
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* Width input */}
                <div style={{ marginBottom: "10px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      color: "#8993a2",
                      marginBottom: "4px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Width
                  </label>
                  <input
                    type="number"
                    value={editWidth}
                    onChange={(e) => setEditWidth(e.target.value)}
                    disabled={isLoading}
                    style={{
                      width: "100%",
                      padding: "6px",
                      fontSize: "12px",
                      background: "#0f1115",
                      color: "#e1e5ea",
                      border: "1px solid #303844",
                      borderRadius: "3px",
                      boxSizing: "border-box",
                      opacity: isLoading ? 0.6 : 1,
                      cursor: isLoading ? "not-allowed" : "text",
                    }}
                  />
                </div>

                {/* Depth input */}
                <div style={{ marginBottom: "10px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      color: "#8993a2",
                      marginBottom: "4px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Depth
                  </label>
                  <input
                    type="number"
                    value={editDepth}
                    onChange={(e) => setEditDepth(e.target.value)}
                    disabled={isLoading}
                    style={{
                      width: "100%",
                      padding: "6px",
                      fontSize: "12px",
                      background: "#0f1115",
                      color: "#e1e5ea",
                      border: "1px solid #303844",
                      borderRadius: "3px",
                      boxSizing: "border-box",
                      opacity: isLoading ? 0.6 : 1,
                      cursor: isLoading ? "not-allowed" : "text",
                    }}
                  />
                </div>

                {/* Height input */}
                <div style={{ marginBottom: "12px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      color: "#8993a2",
                      marginBottom: "4px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Height
                  </label>
                  <input
                    type="number"
                    value={editHeight}
                    onChange={(e) => setEditHeight(e.target.value)}
                    disabled={isLoading}
                    style={{
                      width: "100%",
                      padding: "6px",
                      fontSize: "12px",
                      background: "#0f1115",
                      color: "#e1e5ea",
                      border: "1px solid #303844",
                      borderRadius: "3px",
                      boxSizing: "border-box",
                      opacity: isLoading ? 0.6 : 1,
                      cursor: isLoading ? "not-allowed" : "text",
                    }}
                  />
                </div>

                {/* Buttons */}
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                  }}
                >
                  <button
                    onClick={handleApplyDimensions}
                    disabled={isLoading}
                    style={{
                      flex: 1,
                      padding: "6px",
                      fontSize: "12px",
                      fontWeight: 500,
                      background: "#2a5a3a",
                      color: "#b8e6c8",
                      border: "1px solid #3d7a4f",
                      borderRadius: "3px",
                      cursor: isLoading ? "not-allowed" : "pointer",
                      opacity: isLoading ? 0.6 : 1,
                    }}
                  >
                    {isLoading ? "Applying..." : "Apply"}
                  </button>

                  <button
                    onClick={handleCancelEditDimensions}
                    disabled={isLoading}
                    style={{
                      flex: 1,
                      padding: "6px",
                      fontSize: "12px",
                      background: "#3a3a3a",
                      color: "#b9c1cc",
                      border: "1px solid #4a4a4a",
                      borderRadius: "3px",
                      cursor: isLoading ? "not-allowed" : "pointer",
                      opacity: isLoading ? 0.6 : 1,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Read-only parameters display */
              <div
                style={{
                  border: "1px solid #292f38",
                  borderRadius: "6px",
                  overflow: "hidden",
                }}
              >
                {Object.entries(part.parameters).map(
                  ([key, value], index) => (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        padding: "9px 10px",
                        background:
                          index % 2 === 0
                            ? "#181c22"
                            : "#15191f",
                        borderBottom:
                          index ===
                          Object.keys(part.parameters).length - 1
                            ? "none"
                            : "1px solid #242a32",
                        fontSize: "12px",
                      }}
                    >
                      <span style={{ color: "#8993a2" }}>
                        {prettyParameter(key)}
                      </span>

                      <span
                        style={{
                          color: "#e1e5ea",
                          fontFamily: "monospace",
                          fontSize: "11px",
                        }}
                      >
                        {String(value)}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
          </InspectorAccordion>}

          {/* Relations */}
          {(activeTool === "attach" || activeTool === "detach") && <InspectorAccordion title="Assembly">
          <section>
            <div
              style={{
                color: "#8c96a5",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "10px",
              }}
            >
              Relations
            </div>

            {relationError && !isAttachDialogOpen && (
              <div
                style={{
                  padding: "8px",
                  marginBottom: "10px",
                  background: "#3d1f1f",
                  border: "1px solid #6b3a3a",
                  borderRadius: "4px",
                  color: "#ff8b8b",
                  fontSize: "12px",
                }}
              >
                {relationError}
              </div>
            )}

            {part.features.attached_to ? (
              <div
                style={{
                  padding: "11px",
                  borderRadius: "6px",
                  background: "#1b2028",
                  border: "1px solid #303844",
                  fontSize: "12px",
                  lineHeight: 1.7,
                }}
              >
                <div>
                  <span style={{ color: "#727d8d" }}>
                    Attached to:{" "}
                  </span>

                  <strong style={{ color: "#dce1e7" }}>
                    {parent
                      ? `${prettyName(parent.plugin)} (${parent.id})`
                      : part.features.attached_to.part_id}
                  </strong>
                </div>

                <div>
                  <span style={{ color: "#727d8d" }}>
                    Mount:{" "}
                  </span>

                  <span
                    style={{
                      color: "#b9c1cc",
                      fontFamily: "monospace",
                      fontSize: "11px",
                    }}
                  >
                    {part.features.attached_to.mount_id}
                  </span>
                </div>

                {activeTool === "detach" && <button
                  type="button"
                  onClick={handleDetach}
                  id="tool-detach"
                  disabled={isRelationLoading}
                  style={{
                    width: "100%",
                    marginTop: "10px",
                    padding: "7px 9px",
                    borderRadius: "4px",
                    border: "1px solid #70404a",
                    background: "#3a252b",
                    color: "#f0b5bd",
                    fontSize: "11px",
                    cursor: isRelationLoading ? "not-allowed" : "pointer",
                    opacity: isRelationLoading ? 0.6 : 1,
                  }}
                >
                  {isRelationLoading ? "Detaching..." : "Detach"}
                </button>}
              </div>
            ) : (
              <div
                style={{
                  padding: "11px",
                  borderRadius: "6px",
                  background: "#15191f",
                  border: "1px solid #252b33",
                  color: "#667080",
                  fontSize: "12px",
                }}
              >
                <div>No relations</div>
                {activeTool === "attach" && <button
                  type="button"
                  onClick={handleOpenAttachDialog}
                  id="tool-attach"
                  disabled={isRelationLoading}
                  style={{
                    width: "100%",
                    marginTop: "10px",
                    padding: "7px 9px",
                    borderRadius: "4px",
                    border: "1px solid #3d5d83",
                    background: "#2a3f54",
                    color: "#a8c5dd",
                    fontSize: "11px",
                    cursor: isRelationLoading ? "not-allowed" : "pointer",
                    opacity: isRelationLoading ? 0.6 : 1,
                  }}
                >
                  Attach to...
                </button>}
              </div>
            )}
          </section>
          </InspectorAccordion>}

          {isAttachDialogOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="attach-dialog-title"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
                background: "rgba(0, 0, 0, 0.65)",
              }}
              onClick={handleCloseAttachDialog}
            >
              <div
                style={{
                  width: "min(440px, 100%)",
                  boxSizing: "border-box",
                  padding: "20px",
                  borderRadius: "8px",
                  border: "1px solid #303844",
                  background: "#1a1f27",
                  color: "#cbd2dc",
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <h2
                  id="attach-dialog-title"
                  style={{
                    margin: "0 0 16px",
                    color: "#f2f4f7",
                    fontSize: "16px",
                  }}
                >
                  Attach to...
                </h2>

                {isRelationLoading && (
                  <div style={{ color: "#8993a2", fontSize: "12px" }}>
                    Loading compatible hosts...
                  </div>
                )}

                {relationError && (
                  <div
                    style={{
                      padding: "8px",
                      marginBottom: "12px",
                      background: "#3d1f1f",
                      border: "1px solid #6b3a3a",
                      borderRadius: "4px",
                      color: "#ff8b8b",
                      fontSize: "12px",
                    }}
                  >
                    {relationError}
                  </div>
                )}

                {!isRelationLoading && !relationError && (
                  <>
                    {compatibleHosts.length > 0 ? (
                      <>
                        <label
                          htmlFor="compatible-host"
                          style={{
                            display: "block",
                            marginBottom: "6px",
                            color: "#8993a2",
                            fontSize: "11px",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          Compatible host and mount
                        </label>
                        <select
                          id="compatible-host"
                          value={selectedHostKey}
                          onChange={(event) =>
                            setSelectedHostKey(event.target.value)
                          }
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            padding: "8px",
                            border: "1px solid #3a4450",
                            borderRadius: "4px",
                            background: "#222a32",
                            color: "#b0b8c3",
                            fontSize: "12px",
                          }}
                        >
                          <option value="">Select a host...</option>
                          {compatibleHosts.map((item) => {
                            const key = `${item.part.id}:${item.mount_id}:${item.connection_type}`;
                            return (
                              <option key={key} value={key}>
                                {prettyName(item.part.plugin)} ({item.part.id})
                                {" - "}
                                {item.mount_id}
                              </option>
                            );
                          })}
                        </select>
                      </>
                    ) : (
                      <div style={{ color: "#8993a2", fontSize: "12px" }}>
                        No compatible hosts are available.
                      </div>
                    )}
                  </>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginTop: "20px",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleCloseAttachDialog}
                    disabled={isRelationLoading}
                    style={{
                      flex: 1,
                      padding: "8px",
                      border: "1px solid #4a4a4a",
                      borderRadius: "4px",
                      background: "#3a3a3a",
                      color: "#b9c1cc",
                      cursor: isRelationLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAttach}
                    disabled={
                      isRelationLoading ||
                      !selectedHostKey ||
                      compatibleHosts.length === 0
                    }
                    style={{
                      flex: 1,
                      padding: "8px",
                      border: "1px solid #3d7a4f",
                      borderRadius: "4px",
                      background: "#2a5a3a",
                      color: "#b8e6c8",
                      cursor:
                        isRelationLoading ||
                        !selectedHostKey ||
                        compatibleHosts.length === 0
                          ? "not-allowed"
                          : "pointer",
                      opacity:
                        isRelationLoading ||
                        !selectedHostKey ||
                        compatibleHosts.length === 0
                          ? 0.6
                          : 1,
                    }}
                  >
                    {isRelationLoading ? "Attaching..." : "Attach"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default InspectorPanel;
