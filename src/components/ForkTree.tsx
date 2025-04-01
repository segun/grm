/* eslint-disable prefer-const */
import React, { useMemo } from "react";
import ReactFlow, { Handle, Position, Node, Edge } from "reactflow";
import "reactflow/dist/style.css";

interface ForkData {
  fullName: string;
  htmlUrl: string;
  owner: string;
  name: string;
  isFork: boolean;
  subForks?: ForkData[];
  hasSubforks: boolean;
}

interface CustomNodeProps {
  data: ForkData;
}

const CustomNode: React.FC<CustomNodeProps> = ({ data }) => {
  return (
    <div className="p-2 bg-white border rounded shadow-md">
      <a href={data.htmlUrl} target="_blank" rel="noopener noreferrer">
        {data.fullName}
      </a>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const generateNodesAndEdges = (data: ForkData[] = [], parentId: string | null = null, level: number = 0) => {
  let nodes: Node[] = [],
    edges: Edge[] = [];

  const processFork = (fork: ForkData, parent: string | null) => {
    const nodeId = fork.fullName;
    nodes.push({ id: nodeId, data: fork, position: { x: level * 250, y: nodes.length * 100 } });

    if (parent) {
      edges.push({ id: `${parent}->${nodeId}`, source: parent, target: nodeId });
    }

    const subForks = Array.isArray(fork.subForks) ? fork.subForks : [];
    const grouped = subForks.filter((sf) => !sf.hasSubforks);
    const nonGrouped = subForks.filter((sf) => sf.hasSubforks);
    
    if (grouped.length > 1) {
      const groupId = `${nodeId}-group`;
      nodes.push({
        id: groupId,
        data: { fullName: "Grouped Forks", htmlUrl: "#" },
        position: { x: (level + 1) * 250, y: nodes.length * 100 },
      });
      edges.push({ id: `${nodeId}->${groupId}`, source: nodeId, target: groupId });

      grouped.forEach((sf) => {
        nodes.push({ id: sf.fullName, data: sf, position: { x: (level + 2) * 250, y: nodes.length * 100 } });
        edges.push({ id: `${groupId}->${sf.fullName}`, source: groupId, target: sf.fullName });
      });
    } else if (grouped.length === 1) {
      processFork(grouped[0], nodeId);
    }

    nonGrouped.forEach((sf) => processFork(sf, nodeId));
  };

  if (!data || !Array.isArray(data)) {
    console.error("Invalid data received:", data);
    return { nodes: [], edges: [] };
  }
  data.forEach((repo) => processFork(repo, parentId));

  return { nodes, edges };
};

interface ForkTreeProps {
  data?: ForkData[];
}

const ForkTree: React.FC<ForkTreeProps> = ({ data = [] }) => {
  const { nodes, edges } = useMemo(() => generateNodesAndEdges(data), [data]);

  return (
    <ReactFlow nodes={nodes} edges={edges} fitView nodeTypes={{ custom: CustomNode }}>
      {/* Additional UI elements if needed */}
    </ReactFlow>
  );
};

export default ForkTree;
