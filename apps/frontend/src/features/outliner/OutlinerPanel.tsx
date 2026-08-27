import { Part } from "../parts/types";
import { buildPartTree } from "../parts/buildPartTree";
import OutlinerTree from "./components/OutlinerTree";

type Props = {
  parts: Part[];
};

function OutlinerPanel({ parts }: Props) {
  const tree = buildPartTree(parts);

  return (
    <aside
      style={{
        width: "250px",
        minWidth: "250px",
        background: "#171a1f",
        borderRight: "1px solid #2a2f38",
        padding: "14px",
        boxSizing: "border-box",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          color: "#7f8998",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          marginBottom: "12px",
        }}
      >
        ASSEMBLY
      </div>

      <OutlinerTree nodes={tree} />
    </aside>
  );
}

export default OutlinerPanel;
