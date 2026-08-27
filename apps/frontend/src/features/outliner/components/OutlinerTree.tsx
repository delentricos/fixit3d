import { PartTreeNode } from "../../parts/buildPartTree";
import OutlinerNode from "./OutlinerNode";

type Props = {
  nodes: PartTreeNode[];
};

function OutlinerTree({ nodes }: Props) {
  return (
    <div>
      {nodes.map((node) => (
        <OutlinerNode
          key={node.part.id}
          node={node}
        />
      ))}
    </div>
  );
}

export default OutlinerTree;
