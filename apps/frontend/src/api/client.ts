import {
  CompatibleHostsResponse,
  PartsResponse,
  Part,
} from "../features/parts/types";
import { Plugin } from "../features/plugins/types";

// Thin wrapper around the backend API. Uses native fetch and the Vite
// dev-server proxy (see vite.config.ts), which forwards /api/* to the
// FastAPI backend and strips the /api prefix.

async function get<T>(path: string): Promise<T> {
  const response = await fetch(path);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const detail =
      errorBody && typeof errorBody.detail === "string"
        ? `: ${errorBody.detail}`
        : "";
    throw new Error(
      `Request to ${path} failed with status ${response.status}${detail}`
    );
  }

  return response.json() as Promise<T>;
}


async function post<T>(path: string, body?: object): Promise<T> {
  const options: RequestInit = {
    method: "POST",
  };

  if (body) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }

  const response = await fetch(path, options);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const detail =
      errorBody && typeof errorBody.detail === "string"
        ? `: ${errorBody.detail}`
        : "";
    throw new Error(
      `Request to ${path} failed with status ${response.status}${detail}`
    );
  }

  return response.json() as Promise<T>;
}

async function request<T>(
  path: string,
  options: RequestInit
): Promise<T> {
  const response = await fetch(path, options);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const detail =
      errorBody && typeof errorBody.detail === "string"
        ? `: ${errorBody.detail}`
        : "";
    throw new Error(
      `Request to ${path} failed with status ${response.status}${detail}`
    );
  }

  return response.json() as Promise<T>;
}


export const api = {
  parts: () => get<PartsResponse>("/api/parts/debug"),
  health: () => get("/api/health"),

  version: () => get<{ version: string }>("/api/version"),

  plugins: () => get<Plugin[]>("/api/plugins"),

  enablePlugin: (pluginId: string) =>
    post(`/api/plugins/${pluginId}/enable`),

  disablePlugin: (pluginId: string) =>
    post(`/api/plugins/${pluginId}/disable`),

  executePlugin: (pluginId: string, capability: string, payload: object) =>
    post<Part>(`/api/plugins/${pluginId}/execute`, { capability, payload }),

  generatePart: (pluginId: string, parameters: object) =>
    post<Part>("/api/parts/generate", { plugin_id: pluginId, parameters }),

  compatibleHosts: (partId: string) =>
    get<CompatibleHostsResponse>(
      `/api/parts/${partId}/compatible-hosts`
    ),

  attachPart: (
    partId: string,
    hostId: string,
    mountId: string,
    connectionType: string
  ) =>
    post<Part>(`/api/parts/${partId}/attach`, {
      host_id: hostId,
      mount_id: mountId,
      connection_type: connectionType,
    }),

  detachPart: (partId: string) =>
    request<Part>(`/api/parts/${partId}/attachment`, {
      method: "DELETE",
    }),

  updatePartTransforms: (updates: Array<{
    id: string;
    position?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number };
    scale?: { x: number; y: number; z: number };
  }>) =>
    request<Part[]>("/api/parts/positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    }),

  deletePart: (partId: string) =>
    request<{ id: string; deleted: boolean }>(`/api/parts/${partId}`, {
      method: "DELETE",
    }),

  moveParts: (updates: Array<{ id: string; position: { x: number; y: number; z: number } }>) =>
    api.updatePartTransforms(updates),
};
