import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { api } from "../api/client";
import type { Part } from "../features/parts/types";
import { buildPartTree, PartTreeNode } from "../features/parts/buildPartTree";
import Viewport3D from "../features/viewer/Viewport3D";
import type { MeasurementResult } from "../features/viewer/measurement";
import InspectorPanel from "../features/inspector/InspectorPanel";
import CreatePartDialog from "../features/parts/CreatePartDialog";
import PluginCard from "../features/plugins/components/PluginCard";
import PluginDetailsModal from "../features/plugins/components/PluginDetailsModal";
import CommandToolbar, { ActiveTool } from "../features/toolbar/CommandToolbar";
import type { MoveDelta } from "../features/viewer/MoveGizmo";
import {
  getPartPosition,
  getPartRotation,
  getPartScale,
} from "../features/viewer/partPosition";
import type { Plugin } from "../features/plugins/types";
import { useSelectionStore } from "../shared/state/selectionStore";
import {
  createAnglePlane,
  createMidplane,
  createNormalLinePlane,
  createOffsetPlane,
  createParallelThroughPoint,
  createThreePointsPlane,
  ensureFinitePlane,
  planeFromFace,
  type PlanePickReference,
  type ReferencePlane,
  type ReferencePlaneType,
  type Vec3,
} from "../features/cad/referencePlanes";

function prettyPartName(plugin: string) {
  if (plugin === "box") return "Box";
  if (plugin === "lid") return "Lid";
  if (plugin === "angle_bracket") return "Angle Bracket";
  return plugin.replace(/_/g, " ");
}

function partIcon(plugin: string) {
  if (plugin === "box") return "□";
  if (plugin === "lid") return "▱";
  if (plugin === "angle_bracket") return "∟";
  return "◇";
}

function partReferencePlanes(part: Part | undefined): ReferencePlane[] {
  if (!part) return [];
  const cad = (part.features as Record<string, unknown> | undefined)?.cad as
    | Record<string, unknown>
    | undefined;
  const planes = cad?.reference_planes;
  if (!Array.isArray(planes)) return [];
  return planes.filter((item): item is ReferencePlane => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<ReferencePlane>;
    const finite = (v: unknown) =>
      !!v &&
      typeof v === "object" &&
      Number.isFinite((v as { x?: number }).x) &&
      Number.isFinite((v as { y?: number }).y) &&
      Number.isFinite((v as { z?: number }).z);
    return (
      typeof candidate.id === "string" &&
      typeof candidate.name === "string" &&
      finite(candidate.origin) &&
      finite(candidate.normal) &&
      finite(candidate.x_axis) &&
      finite(candidate.y_axis)
    );
  });
}

function planeFromPick(pick: PlanePickReference, type: ReferencePlaneType = "offset"): ReferencePlane {
  return planeFromFace(
    `pick_${Date.now()}`,
    "Face Plane",
    pick.partId,
    pick.point,
    pick.normal,
    pick.xAxis,
    pick.yAxis,
    type
  );
}

type HoleDraft = {
  partId: string;
  origin: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  xAxis: { x: number; y: number; z: number };
  yAxis: { x: number; y: number; z: number };
  diameter: number;
  depth: number;
  throughAll: boolean;
  center: { x: number; y: number };
  referencePlaneId?: string;
};

type PlaneDraft = {
  partId: string;
  type: ReferencePlaneType;
  name: string;
  distance: number;
  angle: number;
  flip: boolean;
  sourcePlane?: ReferencePlane;
  sourcePlaneB?: ReferencePlane;
  pointA?: Vec3;
  pointB?: Vec3;
  pointC?: Vec3;
  throughPoint?: Vec3;
  lineStart?: Vec3;
  lineEnd?: Vec3;
  error?: string | null;
};

function TreeNode({
  node,
  level = 0,
}: {
  node: PartTreeNode;
  level?: number;
}) {
  const selectedPartIds = useSelectionStore(
    (state) => state.selectedPartIds
  );
  const setSelectedPart = useSelectionStore(
    (state) => state.setSelectedPart
  );
  const toggleSelectedPart = useSelectionStore(
    (state) => state.toggleSelectedPart
  );

  const selected = selectedPartIds.includes(node.part.id);
  const hasChildren = node.children.length > 0;

  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      {level > 0 && (
        <div
          style={{
            position: "absolute",
            left: `${16 + (level - 1) * 16}px`,
            top: 0,
            bottom: 0,
            width: "1px",
            background: "#252b34",
          }}
        />
      )}

      <div
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey) {
            toggleSelectedPart(node.part.id);
            return;
          }

          setSelectedPart(node.part.id);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: "7px",
          height: "34px",
          paddingLeft: `${8 + level * 16}px`,
          paddingRight: "8px",
          borderRadius: "5px",
          marginBottom: "2px",
          color: selected ? "#f4f7fa" : "#c3cad4",
          background: selected
            ? "#26364a"
            : hovered
              ? "#1a2028"
              : "transparent",
          border: selected
            ? "1px solid #3d5d83"
            : "1px solid transparent",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span
          style={{
            width: "12px",
            color: hasChildren ? "#8793a3" : "#4e5866",
            fontSize: "11px",
            textAlign: "center",
          }}
        >
          {hasChildren ? "▾" : "·"}
        </span>

        <span
          style={{
            width: "17px",
            color: selected ? "#aebed2" : "#788494",
            fontSize: "15px",
            lineHeight: 1,
            textAlign: "center",
          }}
        >
          {partIcon(node.part.plugin)}
        </span>

        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: "13px",
            fontWeight: selected ? 600 : 450,
          }}
        >
          {prettyPartName(node.part.plugin)}
        </span>

        <span
          style={{
            color: "#586373",
            fontFamily: "monospace",
            fontSize: "10px",
          }}
        >
          {node.part.id.replace("part_", "#")}
        </span>
      </div>

      {node.children.map((child) => (
        <TreeNode
          key={child.part.id}
          node={child}
          level={level + 1}
        />
      ))}
    </div>
  );
}

function AppLayout() {
  const [parts, setParts] = useState<Part[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [sceneEmpty, setSceneEmpty] = useState(false);
  // Parts created/kept visible while sceneEmpty is active; survives loadParts() refreshes.
  const [visiblePartIds, setVisiblePartIds] = useState<string[]>([]);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [snapGrid, setSnapGrid] = useState("10");
  const [measuredPartId, setMeasuredPartId] = useState<string | null>(null);
  const [measuredPartIds, setMeasuredPartIds] = useState<[string, string] | null>(null);
  const [measurementRequest, setMeasurementRequest] = useState(0);
  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>("none");
  const [holeDraft, setHoleDraft] = useState<HoleDraft | null>(null);
  const [planeDraft, setPlaneDraft] = useState<PlaneDraft | null>(null);
  const initializedPlaneParts = useRef<Set<string>>(new Set());
  const selectedPartIds = useSelectionStore(
    (state) => state.selectedPartIds
  );
  const selectedPartId = useSelectionStore(
    (state) => state.selectedPartId
  );
  const setSelectedPart = useSelectionStore(
    (state) => state.setSelectedPart
  );
  const setSelectedParts = useSelectionStore(
    (state) => state.setSelectedParts
  );
  const clearSelection = useSelectionStore(
    (state) => state.clearSelection
  );
  const selectedPart = parts.find((item) => item.id === selectedPartId);
  const selectedPlanes = useMemo(
    () => partReferencePlanes(selectedPart),
    [selectedPart]
  );

  const handleDeleteSelected = async () => {
    if (selectedPartIds.length === 0) return;

    const idsToDelete = [...selectedPartIds];

    try {
      for (const partId of idsToDelete) {
        await api.deletePart(partId);
      }

      clearSelection();
      setActiveTool("none");
      setMeasuredPartId(null);
      setMeasuredPartIds(null);
      setMeasurement(null);
      await loadParts();
    } catch (error) {
      console.error("Failed to delete part(s):", error);
    }
  };

  const handleGizmoMove = async (delta: MoveDelta) => {
    const updates = selectedPartIds.map((partId) => {
      const selectedPart = parts.find((item) => item.id === partId);
      if (!selectedPart) return null;
      const index = parts.findIndex((item) => item.id === selectedPart.id);
      const position = getPartPosition(selectedPart, index, parts);
      return {
        id: selectedPart.id,
        position: {
          x: position.x + delta.x,
          y: position.y + delta.y,
          z: position.z + delta.z,
        },
      };
    }).filter((update): update is NonNullable<typeof update> => update !== null);

    if (updates.length === 0) return;
    await api.moveParts(updates);
    await loadParts();
  };

  const handleGizmoRotate = async (delta: MoveDelta) => {
    const updates = selectedPartIds.map((partId) => {
      const selectedPart = parts.find((item) => item.id === partId);
      if (!selectedPart) return null;
      const rotation = getPartRotation(selectedPart);
      return {
        id: selectedPart.id,
        rotation: {
          x: rotation.x + delta.x,
          y: rotation.y + delta.y,
          z: rotation.z + delta.z,
        },
      };
    }).filter((update): update is NonNullable<typeof update> => update !== null);

    if (updates.length === 0) return;
    await api.updatePartTransforms(updates);
    await loadParts();
  };

  const handleGizmoScale = async (factors: MoveDelta) => {
    const updates = selectedPartIds.map((partId) => {
      const selectedPart = parts.find((item) => item.id === partId);
      if (!selectedPart) return null;
      const scale = getPartScale(selectedPart);
      return {
        id: selectedPart.id,
        scale: {
          x: scale.x * factors.x,
          y: scale.y * factors.y,
          z: scale.z * factors.z,
        },
      };
    }).filter((update): update is NonNullable<typeof update> => update !== null);

    if (updates.length === 0) return;
    await api.updatePartTransforms(updates);
    await loadParts();
  };

  const loadParts = async () => {
    try {
      const data = await api.parts();
      setParts(data.parts);
      return data.parts;
    } catch (error) {
      console.error("Failed to load parts:", error);
      return [];
    }
  };

  const loadPlugins = async () => {
    try {
      const pluginData = await api.plugins();
      setPlugins(pluginData);
    } catch (error) {
      console.error("Failed to load plugins:", error);
    }
  };

  useEffect(() => {
    loadParts();
    loadPlugins();
  }, []);

  useEffect(() => {
    if (!selectedPartId) return;
    if (initializedPlaneParts.current.has(selectedPartId)) return;

    initializedPlaneParts.current.add(selectedPartId);
    void api
      .executePlugin("plane", "list", { part_id: selectedPartId })
      .then(() => loadParts())
      .catch(() => {
        initializedPlaneParts.current.delete(selectedPartId);
      });
  }, [selectedPartId]);

  const handlePartCreated = async (newPart: Part) => {
    if (sceneEmpty) {
      setVisiblePartIds((prev) =>
        prev.includes(newPart.id) ? prev : [...prev, newPart.id]
      );
      setParts((prev) =>
        prev.some((p) => p.id === newPart.id) ? prev : [...prev, newPart]
      );
      setSelectedPart(newPart.id);
      return;
    }

    await loadParts();
    setSelectedPart(newPart.id);
  };

  const visibleParts = sceneEmpty
    ? parts.filter((part) => visiblePartIds.includes(part.id))
    : parts;
  const tree = buildPartTree(visibleParts);

  useEffect(() => {
    const selectedPair =
      measuredPartIds &&
      selectedPartIds.length === 2 &&
      selectedPartIds[0] === measuredPartIds[0] &&
      selectedPartIds[1] === measuredPartIds[1];
    const selectedSingle =
      measuredPartId !== null &&
      selectedPartIds.length === 1 &&
      selectedPartIds[0] === measuredPartId;

    if (!selectedSingle && !selectedPair) {
      setMeasuredPartId(null);
      setMeasuredPartIds(null);
      setMeasurement(null);
    }
  }, [measuredPartId, measuredPartIds, selectedPartIds]);

  const handleHoleFaceSelected = (partId: string, point: THREE.Vector3, normal: THREE.Vector3) => {
    const worldUp = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3().crossVectors(worldUp, normal).normalize();
    if (xAxis.lengthSq() < 1e-6) {
      const fallback = new THREE.Vector3(1, 0, 0);
      xAxis.crossVectors(fallback, normal).normalize();
    }
    // Keep a right-handed plane basis where local Z axis is xAxis x normal.
    const yAxis = new THREE.Vector3().crossVectors(xAxis, normal).normalize();

    setHoleDraft({
      partId,
      origin: { x: point.x, y: point.y, z: point.z },
      normal: { x: normal.x, y: normal.y, z: normal.z },
      xAxis: { x: xAxis.x, y: xAxis.y, z: xAxis.z },
      yAxis: { x: yAxis.x, y: yAxis.y, z: yAxis.z },
      diameter: 10,
      depth: 20,
      throughAll: false,
      center: { x: 0, y: 0 },
    });
  };

  const handleHoleUpdate = (patch: Partial<HoleDraft>) => {
    setHoleDraft((current) => {
      if (!current) return current;
      return { ...current, ...patch };
    });
  };

  const planePreview = useMemo(() => {
    if (!planeDraft) return null;

    try {
      const id = `preview_${planeDraft.type}`;
      const name = planeDraft.name || "Plane";

      if (planeDraft.type === "origin_xy") {
        return {
          id,
          name: "XY Plane",
          type: "origin_xy",
          part_id: planeDraft.partId,
          origin: { x: 0, y: 0, z: 0 },
          normal: { x: 0, y: 0, z: 1 },
          x_axis: { x: 1, y: 0, z: 0 },
          y_axis: { x: 0, y: 1, z: 0 },
          visible: true,
          references: {},
          parameters: {},
          locked: true,
        } satisfies ReferencePlane;
      }

      if (planeDraft.type === "origin_xz") {
        return {
          id,
          name: "XZ Plane",
          type: "origin_xz",
          part_id: planeDraft.partId,
          origin: { x: 0, y: 0, z: 0 },
          normal: { x: 0, y: 1, z: 0 },
          x_axis: { x: 1, y: 0, z: 0 },
          y_axis: { x: 0, y: 0, z: 1 },
          visible: true,
          references: {},
          parameters: {},
          locked: true,
        } satisfies ReferencePlane;
      }

      if (planeDraft.type === "origin_yz") {
        return {
          id,
          name: "YZ Plane",
          type: "origin_yz",
          part_id: planeDraft.partId,
          origin: { x: 0, y: 0, z: 0 },
          normal: { x: 1, y: 0, z: 0 },
          x_axis: { x: 0, y: 1, z: 0 },
          y_axis: { x: 0, y: 0, z: 1 },
          visible: true,
          references: {},
          parameters: {},
          locked: true,
        } satisfies ReferencePlane;
      }

      if (planeDraft.type === "offset") {
        if (!planeDraft.sourcePlane) throw new Error("Select a source plane or face");
        return createOffsetPlane(id, name, planeDraft.sourcePlane, planeDraft.distance, planeDraft.flip);
      }

      if (planeDraft.type === "parallel_point") {
        if (!planeDraft.sourcePlane) throw new Error("Select a source plane");
        if (!planeDraft.throughPoint) throw new Error("Select a point");
        return createParallelThroughPoint(id, name, planeDraft.sourcePlane, planeDraft.throughPoint);
      }

      if (planeDraft.type === "three_points") {
        if (!planeDraft.pointA || !planeDraft.pointB || !planeDraft.pointC) {
          throw new Error("Select three points");
        }
        return createThreePointsPlane(
          id,
          name,
          planeDraft.partId,
          planeDraft.pointA,
          planeDraft.pointB,
          planeDraft.pointC
        );
      }

      if (planeDraft.type === "normal_line_point") {
        if (!planeDraft.lineStart || !planeDraft.lineEnd || !planeDraft.throughPoint) {
          throw new Error("Select line start/end and point");
        }
        return createNormalLinePlane(
          id,
          name,
          planeDraft.partId,
          planeDraft.lineStart,
          planeDraft.lineEnd,
          planeDraft.throughPoint
        );
      }

      if (planeDraft.type === "midplane") {
        if (!planeDraft.sourcePlane || !planeDraft.sourcePlaneB) {
          throw new Error("Select two parallel planes");
        }
        return createMidplane(id, name, planeDraft.sourcePlane, planeDraft.sourcePlaneB);
      }

      if (planeDraft.type === "angle") {
        if (!planeDraft.sourcePlane || !planeDraft.lineStart || !planeDraft.lineEnd) {
          throw new Error("Select source plane and axis line");
        }
        return createAnglePlane(
          id,
          name,
          planeDraft.sourcePlane,
          planeDraft.lineStart,
          planeDraft.lineEnd,
          planeDraft.angle,
          planeDraft.flip
        );
      }

      if (planeDraft.type === "tangent") {
        throw new Error("Tangent plane currently supports only cylindrical/conical surfaces")
      }

      throw new Error("Unsupported plane type");
    } catch {
      return null;
    }
  }, [planeDraft]);

  const handlePlaneReferenceSelected = (reference: PlanePickReference) => {
    setPlaneDraft((current) => {
      if (!current) return current;
      const fromFace = planeFromPick(reference);

      if (current.type === "offset") {
        return { ...current, sourcePlane: fromFace, error: null };
      }

      if (current.type === "parallel_point") {
        if (!current.sourcePlane) {
          return { ...current, sourcePlane: fromFace, error: null };
        }
        return { ...current, throughPoint: reference.point, error: null };
      }

      if (current.type === "three_points") {
        if (!current.pointA) return { ...current, pointA: reference.point, error: null };
        if (!current.pointB) return { ...current, pointB: reference.point, error: null };
        return { ...current, pointC: reference.point, error: null };
      }

      if (current.type === "normal_line_point") {
        if (!current.lineStart) return { ...current, lineStart: reference.point, error: null };
        if (!current.lineEnd) return { ...current, lineEnd: reference.point, error: null };
        return { ...current, throughPoint: reference.point, error: null };
      }

      if (current.type === "midplane") {
        if (!current.sourcePlane) return { ...current, sourcePlane: fromFace, error: null };
        return { ...current, sourcePlaneB: fromFace, error: null };
      }

      if (current.type === "angle") {
        if (!current.sourcePlane) return { ...current, sourcePlane: fromFace, error: null };
        if (!current.lineStart) return { ...current, lineStart: reference.point, error: null };
        return { ...current, lineEnd: reference.point, error: null };
      }

      return current;
    });
  };

  const handlePlaneApply = async () => {
    if (!planeDraft || !selectedPartId) return;

    try {
      if (planeDraft.type === "origin_xy" || planeDraft.type === "origin_xz" || planeDraft.type === "origin_yz") {
        await api.executePlugin("plane", "list", { part_id: selectedPartId });
        await loadParts();
        return;
      }

      if (!planePreview) {
        setPlaneDraft((current) =>
          current
            ? { ...current, error: "Invalid references for current plane type" }
            : current
        );
        return;
      }

      ensureFinitePlane(planePreview);
      const finalPlane: ReferencePlane = {
        ...planePreview,
        id: `plane_${Date.now()}`,
        name: planeDraft.name || `Plane ${selectedPlanes.length + 1}`,
        part_id: selectedPartId,
        visible: true,
        locked: false,
      };

      await api.executePlugin("plane", "apply", {
        part_id: selectedPartId,
        plane: finalPlane,
      });
      setPlaneDraft(null);
      setActiveTool("none");
      await loadParts();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create reference plane";
      setPlaneDraft((current) => (current ? { ...current, error: message } : current));
    }
  };

  const handlePlaneCancel = () => {
    setPlaneDraft(null);
    setActiveTool("none");
  };

  const handlePlaneToggleVisibility = async (planeId: string, visible: boolean) => {
    if (!selectedPartId) return;
    try {
      await api.executePlugin("plane", "toggle_visibility", {
        part_id: selectedPartId,
        plane_id: planeId,
        visible,
      });
      await loadParts();
    } catch (error) {
      console.error("Failed to toggle plane visibility", error);
    }
  };

  const handlePlaneDelete = async (planeId: string) => {
    if (!selectedPartId) return;
    try {
      await api.executePlugin("plane", "delete", {
        part_id: selectedPartId,
        plane_id: planeId,
      });
      await loadParts();
    } catch (error) {
      console.error("Failed to delete plane", error);
    }
  };

  const handlePlaneRename = async (planeId: string, name: string) => {
    if (!selectedPartId) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await api.executePlugin("plane", "rename", {
        part_id: selectedPartId,
        plane_id: planeId,
        name: trimmed,
      });
      await loadParts();
    } catch (error) {
      console.error("Failed to rename plane", error);
    }
  };

  const handleHoleUsePlane = (planeId: string) => {
    const plane = selectedPlanes.find((item) => item.id === planeId);
    if (!plane) return;
    setHoleDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        referencePlaneId: plane.id,
        origin: plane.origin,
        normal: plane.normal,
        xAxis: plane.x_axis,
        yAxis: plane.y_axis,
        center: { x: 0, y: 0 },
      };
    });
  };

  const handleHoleApply = async () => {
    if (!holeDraft) return;

    const diameter = Number(holeDraft.diameter);
    const depth = Number(holeDraft.depth);
    if (!Number.isFinite(diameter) || diameter <= 0) {
      return;
    }
    if (!holeDraft.throughAll && (!Number.isFinite(depth) || depth <= 0)) {
      return;
    }

    try {
      await api.executePlugin("hole", "apply", {
        part_id: holeDraft.partId,
        feature: {
          id: `hole_${Date.now()}`,
          partId: holeDraft.partId,
          diameter,
          depth: holeDraft.throughAll ? null : depth,
          throughAll: holeDraft.throughAll,
          position: {
            x: holeDraft.origin.x + holeDraft.xAxis.x * holeDraft.center.x + holeDraft.yAxis.x * holeDraft.center.y,
            y: holeDraft.origin.y + holeDraft.xAxis.y * holeDraft.center.x + holeDraft.yAxis.y * holeDraft.center.y,
            z: holeDraft.origin.z + holeDraft.xAxis.z * holeDraft.center.x + holeDraft.yAxis.z * holeDraft.center.y,
          },
          normal: holeDraft.normal,
          reference_plane: {
            id: holeDraft.referencePlaneId ?? `plane_${holeDraft.partId}`,
            part_id: holeDraft.partId,
            origin: holeDraft.origin,
            normal: holeDraft.normal,
            x_axis: holeDraft.xAxis,
            y_axis: holeDraft.yAxis,
            source_face: holeDraft.referencePlaneId ?? "selection",
          },
          center: holeDraft.center,
        },
      });
      setHoleDraft(null);
      setActiveTool("none");
      await loadParts();
    } catch (error) {
      console.error("Failed to apply hole", error);
    }
  };

  const handleHoleCancel = () => {
    setHoleDraft(null);
    setActiveTool("none");
  };

  useEffect(() => {
    if (activeTool === "delete") {
      void handleDeleteSelected();
      return;
    }

    if (activeTool !== "hole") {
      setHoleDraft(null);
    }

    if (activeTool === "plane" && selectedPartId) {
      setPlaneDraft((current) =>
        current && current.partId === selectedPartId
          ? current
          : {
              partId: selectedPartId,
              type: "offset",
              name: `Plane ${selectedPlanes.length + 1}`,
              distance: 10,
              angle: 45,
              flip: false,
              error: null,
            }
      );
    }

    if (activeTool !== "plane") {
      setPlaneDraft(null);
    }
  }, [selectedPartIds, activeTool, selectedPartId, selectedPlanes.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? "";
      const isEditable =
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        !!target?.isContentEditable;

      if (isEditable || selectedPartIds.length === 0) return;

      if (event.key === "Escape") {
        event.preventDefault();
        if (activeTool === "hole") {
          handleHoleCancel();
        }
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        void handleDeleteSelected();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPartIds, handleDeleteSelected]);

  // Selection safety-net: if selected parts are no longer part of the
  // currently visible scene (e.g. Empty Scene, future deletion), prune them
  // instead of leaving references to parts that no longer exist.
  useEffect(() => {
    const nextVisibleIds = selectedPartIds.filter((partId) =>
      visibleParts.some((part) => part.id === partId)
    );

    if (nextVisibleIds.length !== selectedPartIds.length) {
      setSelectedParts(nextVisibleIds);
    }
  }, [visibleParts, selectedPartIds, setSelectedParts]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "grid",
        gridTemplateRows: "52px 1fr",
        gridTemplateColumns: "240px 1fr 280px",
        background: "#0b0d10",
        color: "#e8ecf1",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px",
          borderBottom: "1px solid #252a32",
          background: "#111419",
          fontSize: "14px",
          fontWeight: 600,
        }}
      >
        <span>FixIt3D</span>
        <button
          onClick={() => setIsCreateDialogOpen(true)}
          style={{
            padding: "6px 12px",
            background: "#2563eb",
            border: "1px solid #1e40af",
            borderRadius: "4px",
            color: "#e0f1ff",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#1d4ed8";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#2563eb";
          }}
        >
          + Create Part
        </button>

        <button
          type="button"
          onClick={() => {
            setSceneEmpty(true);
            setVisiblePartIds([]);
            clearSelection();
          }}
          style={{
            marginLeft: "8px",
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid #555",
            background: "#222",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Empty Scene
        </button>
      </header>

      <aside
        style={{
          borderRight: "1px solid #252a32",
          background: "#111419",
          padding: "16px 10px",
          overflow: "auto",
        }}
      >
        <div
          style={{
            padding: "0 8px",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "#7f8998",
            marginBottom: "14px",
          }}
        >
          ASSEMBLY
        </div>

        {tree.map((node) => (
          <TreeNode
            key={node.part.id}
            node={node}
          />
        ))}

        <div
          style={{
            padding: "0 8px",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "#7f8998",
            margin: "18px 0 8px",
          }}
        >
          REFERENCE PLANES
        </div>

        {selectedPlanes.length === 0 && (
          <div style={{ color: "#5e6775", fontSize: "11px", padding: "0 8px 8px" }}>
            Select a part to view planes
          </div>
        )}

        {selectedPlanes.map((plane) => (
          <div
            key={plane.id}
            style={{
              margin: "0 8px 6px",
              padding: "6px 8px",
              border: "1px solid #2b323d",
              borderRadius: "6px",
              background: "#141920",
              display: "grid",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
              <input
                defaultValue={plane.name}
                onBlur={(event) => handlePlaneRename(plane.id, event.target.value)}
                disabled={plane.locked}
                style={{
                  flex: 1,
                  background: "#0f1319",
                  color: "#dce6f4",
                  border: "1px solid #334154",
                  borderRadius: "4px",
                  fontSize: "11px",
                  padding: "3px 5px",
                }}
              />
              <span style={{ color: "#708096", fontSize: "10px" }}>{plane.type}</span>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={() => handlePlaneToggleVisibility(plane.id, !plane.visible)}
                style={{
                  flex: 1,
                  background: plane.visible ? "#244a35" : "#2a2f38",
                  color: "#eaf3ff",
                  border: "1px solid #456b56",
                  borderRadius: "4px",
                  padding: "4px 6px",
                  fontSize: "11px",
                }}
              >
                {plane.visible ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                onClick={() => handlePlaneDelete(plane.id)}
                disabled={plane.locked}
                style={{
                  flex: 1,
                  background: plane.locked ? "#1e2228" : "#4a2a2a",
                  color: plane.locked ? "#5f6c80" : "#ffd8d8",
                  border: "1px solid #6b3a3a",
                  borderRadius: "4px",
                  padding: "4px 6px",
                  fontSize: "11px",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 8px",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "#7f8998",
            margin: "18px 0 8px",
          }}
        >
          <span>PLUGINS</span>
          <span style={{ fontFamily: "monospace", color: "#586373" }}>
            {plugins.length}
          </span>
        </div>

        {plugins.map((plugin) => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            onPluginChanged={loadPlugins}
            onPluginDetails={setSelectedPlugin}
          />
        ))}
      </aside>

      <main
        style={{
          minWidth: 0,
          minHeight: 0,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <CommandToolbar
          selectedPartCount={selectedPartIds.length}
          canEditDimensions={
            selectedPartIds.length === 1 &&
            parts.find((part) => part.id === selectedPartId)?.plugin === "box"
          }
          activeTool={activeTool}
          onToolSelect={setActiveTool}
        />
        <Viewport3D
          parts={visibleParts}
          grid={snapGrid}
          measuredPartId={
            selectedPartIds.length === 1 ? measuredPartId : null
          }
          measuredPartIds={
            selectedPartIds.length === 2 ? measuredPartIds : null
          }
          measurementRequest={measurementRequest}
          onMeasurementChange={setMeasurement}
          onMoveDelta={handleGizmoMove}
          onRotateDelta={handleGizmoRotate}
          onScaleFactors={handleGizmoScale}
          activeTool={activeTool}
          holeDraft={holeDraft}
          referencePlanes={selectedPlanes}
          planeDraft={planeDraft}
          planePreview={planePreview}
          onHoleFaceSelected={handleHoleFaceSelected}
          onHoleUpdate={handleHoleUpdate}
          onHoleApply={handleHoleApply}
          onHoleCancel={handleHoleCancel}
          onHoleUsePlane={handleHoleUsePlane}
          onPlaneReferenceSelected={handlePlaneReferenceSelected}
          onPlaneDraftChange={setPlaneDraft}
          onPlaneApply={handlePlaneApply}
          onPlaneCancel={handlePlaneCancel}
          onToolCancel={() => {
            setActiveTool("none");
            setSelectedParts(selectedPartIds);
          }}
        />
      </main>

      <aside
        style={{
          minWidth: 0,
          minHeight: 0,
          borderLeft: "1px solid #252a32",
          background: "#111419",
          overflow: "auto",
        }}
      >
        <InspectorPanel
          parts={visibleParts}
          snapGrid={snapGrid}
          onSnapGridChange={setSnapGrid}
          activeTool={activeTool}
          onToolCancel={() => setActiveTool("none")}
          measurement={measurement}
          onMeasure={(partId) => {
            setMeasuredPartId(partId);
            setMeasuredPartIds(null);
            setMeasurementRequest((request) => request + 1);
          }}
          onMeasureBetween={(partIds) => {
            setMeasuredPartId(null);
            setMeasuredPartIds(partIds);
            setMeasurementRequest((request) => request + 1);
          }}
          onPartUpdated={loadParts}
        />
      </aside>

      <CreatePartDialog
        isOpen={isCreateDialogOpen}
        parts={parts}
        onClose={() => setIsCreateDialogOpen(false)}
        onPartCreated={handlePartCreated}
      />

      {selectedPlugin && (
        <PluginDetailsModal
          plugin={selectedPlugin}
          onClose={() => setSelectedPlugin(null)}
        />
      )}
    </div>
  );
}

export default AppLayout;
