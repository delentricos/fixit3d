import { PartTreeNode } from "../../parts/buildPartTree";
import { useSelectionStore } from "../../../shared/state/selectionStore";

type Props = {
  node: PartTreeNode;
  depth?: number;
};

function OutlinerNode({ node, depth = 0 }: Props) {
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

  const label =
    node.part.plugin.charAt(0).toUpperCase() +
    node.part.plugin.slice(1);

  return (
    <div>
      <button
        type="button"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey) {
            toggleSelectedPart(node.part.id);
            return;
          }

          setSelectedPart(node.part.id);
        }}
        style={{
          width: "100%",
          border: "none",
          background: selected
            ? "rgba(91, 141, 239, 0.18)"
            : "transparent",
          color: selected ? "#ffffff" : "#b8c0cc",
          textAlign: "left",
          padding: "7px 10px",
          paddingLeft: `${12 + depth * 18}px`,
          cursor: "pointer",
          borderRadius: "6px",
          fontSize: "13px",
        }}
      >
        {node.children.length > 0 ? "▾ " : "• "}
        {label}
        <span
          style={{
            marginLeft: "8px",
            color: "#687384",
            fontSize: "11px",
          }}
        >
          {node.part.id}
        </span>
      </button>

      {node.children.map((child) => (
        <OutlinerNode
          key={child.part.id}
          node={child}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export default OutlinerNode;
