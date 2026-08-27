import { create } from "zustand";

interface SelectionState {
  selectedPartIds: string[];
  selectedPartId: string | null;
  hoveredPartId: string | null;
  setSelectedPart: (id: string | null) => void;
  setSelectedParts: (ids: string[]) => void;
  toggleSelectedPart: (id: string) => void;
  clearSelection: () => void;
  setHoveredPart: (id: string | null) => void;
}

const normalizeSelection = (ids: string[]) =>
  ids.filter((id, index, array) => array.indexOf(id) === index);

const primaryPartId = (ids: string[]) =>
  ids.length > 0 ? ids[ids.length - 1] : null;

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedPartIds: [],
  selectedPartId: null,
  hoveredPartId: null,

  setSelectedPart: (id) => {
    const nextIds = id ? [id] : [];
    set({
      selectedPartIds: nextIds,
      selectedPartId: primaryPartId(nextIds),
    });
  },

  setSelectedParts: (ids) => {
    const nextIds = normalizeSelection(ids);
    set({
      selectedPartIds: nextIds,
      selectedPartId: primaryPartId(nextIds),
    });
  },

  toggleSelectedPart: (id) =>
    set((state) => {
      const isSelected = state.selectedPartIds.includes(id);
      const nextIds = isSelected
        ? state.selectedPartIds.filter((partId) => partId !== id)
        : [...state.selectedPartIds, id];

      return {
        selectedPartIds: nextIds,
        selectedPartId: primaryPartId(nextIds),
      };
    }),

  clearSelection: () =>
    set({
      selectedPartIds: [],
      selectedPartId: null,
    }),

  setHoveredPart: (id) => set({ hoveredPartId: id }),
}));
