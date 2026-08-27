# FixIt3D Frontend Architecture Report
## Connected to Linked Plugin System

---

## 1. CURRENT DATA FLOW: HOW PARTS ARE LOADED

### Current State
- **Entry Point**: [src/main.tsx](apps/frontend/src/main.tsx) → [src/app/App.tsx](apps/frontend/src/app/App.tsx) → [src/app/AppLayout.tsx](apps/frontend/src/app/AppLayout.tsx)
- **Initial Load**: Single fetch on component mount via `api.parts()` 
- **API Endpoint**: `GET /api/parts/debug` (returns all parts from backend)
- **Storage**: Parts stored in local React state `useState<Part[]>`

```typescript
// AppLayout.tsx - Lines 144-150
useEffect(() => {
  api.parts()
    .then((data) => setParts(data.parts))
    .catch((error) => { console.error("Failed to load parts:", error); });
}, []);
```

### Data Structure
```typescript
// Parts loaded as objects with:
{
  id: string;
  plugin: string;
  parameters: Record<string, number | string>;  // width, depth, height, etc.
  features: {
    attached_to?: { part_id: string; mount_id: string };
    mount_position?: { x, y, z };
    mount_orientation?: { x, y, z };
    [key: string]: unknown;
  };
  geometry: { type: string; [key: string]: unknown };
}
```

### Key Issue
❌ **Parts only loaded once on app startup. No refresh mechanism after backend updates.**

---

## 2. HOW PART PARAMETERS ARE CURRENTLY EDITED

### Current State
**No parameter editing UI exists.** Parameters are displayed read-only.

- **InspectorPanel.tsx** (Lines 121-171): Displays all parameters in a read-only table
- Shows formatted parameter names and values
- **No input fields, sliders, or buttons to modify values**

```typescript
// InspectorPanel.tsx - Parameters display (read-only)
{Object.entries(part.parameters).map(([key, value], index) => (
  <div>
    <span>{prettyParameter(key)}</span>
    <span>{String(value)}</span>  {/* ← Display only */}
  </div>
))}
```

### State Management
- **Selection State**: Managed via Zustand store [selectionStore.ts](apps/frontend/src/shared/state/selectionStore.ts)
- **Part State**: Managed via React local state in AppLayout
- **No other state management** (no Redux, Zustand for parts, or global store)

### Where Box Dimensions Would Be Edited
❌ **Does not exist yet.** Would need:
1. Input fields or sliders for width, depth, height
2. Submit button or auto-save on change
3. API call to backend `POST /api/plugins/box/execute` with capability `set_dimensions`

---

## 3. HOW 3D GEOMETRY UPDATES AFTER PARAMETER CHANGES

### Current State
- **PartMesh.tsx** (Lines 26-93): Geometry is created in `useMemo` 
- **Dependency Array**: `[part.geometry?.type, width, height, depth, part.parameters.thickness]`
- **When it Updates**: Only when extracted values from `part.parameters` change

```typescript
// PartMesh.tsx - Lines 26-93
const geometry = useMemo(() => {
  const geometryType = part.geometry?.type;
  const width = Number(part.parameters.width ?? 100);
  const depth = Number(part.parameters.depth ?? 100);
  const height = Number(part.parameters.height ?? 20);
  
  // Build Three.js geometry based on these values
  return new THREE.BoxGeometry(width, height, depth);
}, [part.geometry?.type, width, height, depth, part.parameters.thickness]);
```

### Position Updates
- **Position Calculation**: [PartMesh.tsx Lines 97-180]
- Uses `part.features.mount_position` to position child parts (Lids) relative to parent (Box)
- Coordinate transformation from backend (x=width, y=depth, z=height) to Three.js (X=width, Y=height, Z=depth)

### 3D Rendering
- **Framework**: Three.js via react-three-fiber (Canvas, useThree)
- **Viewport**: [Viewport3D.tsx](apps/frontend/src/features/viewer/Viewport3D.tsx)
- **Scene**: [ViewportScene component](apps/frontend/src/features/viewer/Viewport3D.tsx#L54)
- Renders meshes for each part, applies materials, lighting, and camera controls

### Key Issue
❌ **After a Box parameter changes on backend, Lid geometry won't update unless parts list is refreshed.**

---

## 4. WHERE BOX DIMENSIONS ARE EDITED

### Current State
❌ **Not implemented.** Box dimensions currently not editable in UI.

### How It Would Work (Required Implementation)
1. **InspectorPanel** needs to detect if part is a "box" or "lid"
2. Show editable fields for dimension parameters (width, depth, height)
3. On change, call backend via:
   ```
   POST /api/plugins/box/execute
   {
     "capability": "set_dimensions",
     "payload": { "id": "part_005", "width": 250, "depth": 180, ... }
   }
   ```
4. Backend executes `box.set_dimensions()` which:
   - Updates Box parameters
   - Saves Box
   - Calls `connection_manager.update_connected_parts(box)`
   - Lid automatically updates on backend ✓
5. **Frontend needs to reload parts after backend update**

---

## 5. WHERE LID GEOMETRY WOULD UPDATE WHEN BOX CHANGES

### Current State
❌ **No mechanism for this.** Lid component only re-renders if its own `part` object changes.

### What Needs to Happen
1. User changes Box width/depth in frontend UI
2. Frontend POST to `POST /api/plugins/box/execute`
3. Backend updates Box, calls `connection_manager.update_connected_parts()`, returns updated Box
4. **Frontend needs to**:
   - Detect that connected Lids were updated
   - Reload Lid parts from backend
   - Update React state with new Lid parameters
   - PartMesh re-renders with new geometry (via useMemo)
   - Lid mesh position recalculated (via mount_position changes)

### The Problem
- Currently, only the Box part object is returned from the API
- Lid updates happen on backend but frontend doesn't know about them
- No polling, WebSocket, or event notification system

---

## 6. WHETHER FRONTEND REFRESHES CONNECTED PARTS

### Current State
❌ **No.** Frontend has no mechanism to refresh parts after backend updates.

**Current behavior:**
- Parts loaded once on startup
- Local state holds all parts
- No re-fetching after API calls
- No polling
- No WebSocket/subscriptions
- No event system

### Required for Linked Updates
Need one of:
1. **Manual Refresh** (Simplest): Button "Refresh Scene" that calls `api.parts()` again
2. **Auto-Refresh** (Better): After API call succeeds, automatically reload all parts
3. **Smart Refresh** (Best): After `set_dimensions` call succeeds, reload only affected parts

---

## API ENDPOINTS AVAILABLE

### Backend Already Provides
```
GET  /api/parts/debug              → Returns all parts { parts: Part[] }
POST /api/plugins/{id}/execute     → Execute capability
                                     Body: { capability: string, payload: {} }
```

### Not Yet Implemented (Needed)
- No dedicated part update endpoint
- No batch reload endpoint
- No subscription/polling mechanism

---

## FRONTEND ARCHITECTURE SUMMARY

```
┌─────────────────────────────────────────────────────────────┐
│ App Entry → AppLayout                                        │
│                                                              │
│  useState<Part[]>  ← api.parts() [ONCE on mount]            │
│  Zustand: useSelectionStore (selected part ID)             │
│                                                              │
│  ├─ OutlinerPanel (left sidebar)                            │
│  │   └─ BuildPartTree → TreeNode hierarchy                 │
│  │                                                          │
│  ├─ Viewport3D (center 3D view)                             │
│  │   └─ PartMesh (per part)                                │
│  │       ├─ useMemo(geometry) ← parameters                 │
│  │       └─ Canvas (Three.js, react-three-fiber)           │
│  │                                                          │
│  └─ InspectorPanel (right sidebar) ❌                       │
│      ├─ Displays part info (read-only)                     │
│      ├─ Shows parameters (NO EDIT UI)                      │
│      └─ Shows relationships (attached_to)                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## SMALLEST CLEAN IMPLEMENTATION PATH FOR LIVE LINKED UPDATES

### Phase 1: Enable Box Dimension Editing (Prerequisite)
**Files to modify**: [InspectorPanel.tsx](apps/frontend/src/features/inspector/InspectorPanel.tsx), [client.ts](apps/frontend/src/api/client.ts)

**1a. Add API method to client.ts**
```typescript
// client.ts - Add:
async function post<T>(path: string, body: object): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(...);
  return response.json() as Promise<T>;
}

export const api = {
  parts: () => get<PartsResponse>("/api/parts/debug"),
  executePlugin: (pluginId: string, capability: string, payload: any) =>
    post(`/api/plugins/${pluginId}/execute`, { capability, payload }),
  // ... existing methods ...
};
```

**1b. Add dimension editing UI to InspectorPanel.tsx**
- Add conditional rendering: if part.plugin === "box", show editable fields
- Create `DimensionInput` component for width, depth, height
- Add "Apply" button
- On submit: call `api.executePlugin("box", "set_dimensions", payload)`

### Phase 2: Add Auto-Refresh After Backend Update (Main Feature)
**Files to modify**: [AppLayout.tsx](apps/frontend/src/app/AppLayout.tsx), [InspectorPanel.tsx](apps/frontend/src/features/inspector/InspectorPanel.tsx)

**2a. Extract parts-loading logic to a separate function**
```typescript
// AppLayout.tsx
const loadParts = useCallback(() => {
  api.parts()
    .then((data) => setParts(data.parts))
    .catch((error) => console.error("Failed to load parts:", error));
}, []);

useEffect(() => { loadParts(); }, []);
```

**2b. Pass refresh function to InspectorPanel**
```typescript
// AppLayout.tsx
<InspectorPanel parts={parts} onPartUpdated={loadParts} />
```

**2c. Call refresh after dimension update**
```typescript
// InspectorPanel.tsx - In dimension edit handler:
const handleApplyDimensions = async () => {
  try {
    await api.executePlugin("box", "set_dimensions", payload);
    onPartUpdated();  // ← Reload all parts from backend
  } catch (error) {
    console.error("Update failed:", error);
  }
};
```

### Phase 3: Optimize (Optional - Can be added later)
- Add loading indicator during refresh
- Cache parts and only update changed ones
- Add optimistic UI updates
- Detect which parts changed and only refresh those
- Add error recovery UI

---

## CRITICAL OBSERVATIONS

1. **Spanish UI Text**: Inspector uses Spanish ("Parámetros", "Relaciones", "Anclado a")
   - ✓ **PluginCard.tsx uses English** (plugin management UI)
   - ⚠️ **Recommendation**: Keep InspectorPanel in English per requirements (all user text must be English)
   - **Text to change**: 
     - "Parámetros" → "Parameters"
     - "Relaciones" → "Relations"
     - "Anclado a" → "Attached to"
     - "Desconocido" → "Unknown"
     - "Sin relaciones" → "No relations"
     - "Selecciona una pieza para ver sus propiedades" → "Select a part to see its properties"
     - "Punto" → "Mount"

2. **No Error Handling for Updates**: If Box update fails, frontend won't know

3. **No Visual Feedback**: No loading spinner or success message when parts update

4. **State Consistency**: After backend update, local state is stale until refresh

---

## RECOMMENDED MINIMAL IMPLEMENTATION ORDER

1. ✅ **Backend linked connections** — DONE ✓
2. ⏳ **Add API method to execute plugins** — Add 10 lines to `client.ts`
3. ⏳ **Add dimension edit UI to InspectorPanel** — ~50 lines new component
4. ⏳ **Add auto-refresh after updates** — ~10 lines (pass callback, call it)
5. ⏳ **Fix Spanish text to English** — Bulk string replacement
6. ⏳ **Test end-to-end** — Manual Box dimension change → Lid updates

**Estimated effort**: 2-3 hours for complete implementation

---

## ENTRY POINTS FOR MODIFICATION

| File | Purpose | Change |
|------|---------|--------|
| [src/api/client.ts](apps/frontend/src/api/client.ts) | API communication | Add `executePlugin()` method |
| [src/app/AppLayout.tsx](apps/frontend/src/app/AppLayout.tsx) | Main layout + parts state | Extract load logic, add refresh callback |
| [src/features/inspector/InspectorPanel.tsx](apps/frontend/src/features/inspector/InspectorPanel.tsx) | Part details panel | Add dimension editing UI, fix Spanish text, call refresh |
| [src/features/viewer/components/PartMesh.tsx](apps/frontend/src/features/viewer/components/PartMesh.tsx) | 3D rendering | Already works (no change needed) |
| [src/shared/state/selectionStore.ts](apps/frontend/src/shared/state/selectionStore.ts) | Part selection | Already works (no change needed) |

---

**Report Generated**: Architecture inspection complete.  
**Status**: Frontend ready for linked-update integration. No architectural changes needed — only incremental additions to existing components.
