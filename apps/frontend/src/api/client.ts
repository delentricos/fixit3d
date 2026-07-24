// Thin wrapper around the backend API. Uses native fetch and the Vite
// dev-server proxy (see vite.config.ts), which forwards /api/* to the
// FastAPI backend and strips the /api prefix.

async function get<T>(path: string): Promise<T> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Request to ${path} failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}


async function post<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Request to ${path} failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}


export const api = {
  health: () => get("/api/health"),

  version: () => get("/api/version"),

  plugins: () => get("/api/plugins"),

  enablePlugin: (pluginId: string) =>
    post(`/api/plugins/${pluginId}/enable`),

  disablePlugin: (pluginId: string) =>
    post(`/api/plugins/${pluginId}/disable`),
};