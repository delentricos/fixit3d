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

export const api = {
  // GET /api/health -> backend GET /health
  health: () => get("/api/health"),

  // GET /api/version -> backend GET /version
  version: () => get("/api/version"),
};