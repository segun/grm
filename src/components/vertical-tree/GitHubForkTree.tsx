import React, { useEffect } from 'react';
import ReactFlow, { 
  Node,
  Edge,
  Controls,
  Background,
  MarkerType,
  useNodesState,
  useEdgesState
} from 'reactflow';
import 'reactflow/dist/style.css';

interface ForkData {
  fullName: string;
  htmlUrl: string;
  owner: string;
  name: string;
  isFork: boolean;
  subForks: ForkData | ForkData[];
  hasSubforks: boolean;
  isAncestor?: boolean;
}

interface NodeData {
  label: string;
  url: string;
  isFork: boolean;
  isAncestor?: boolean;
}

interface GitHubForkTreeProps {
  treeData: ForkData[];
}

const GitHubForkTree: React.FC<GitHubForkTreeProps> = ({ treeData }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const { flowNodes, flowEdges } = processTreeData(treeData);
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [treeData, setNodes, setEdges]);

  const processTreeData = (data: ForkData[]) => {
    const flowNodes: Node<NodeData>[] = [];
    const flowEdges: Edge[] = [];
    let nodeId = 0;
    let yOffset = 0;
    const xSpacing = 200;
    const ySpacing = 100;
    
    const nodePositions: Record<string, { id: string, x: number, y: number }> = {};
    
    const processNode = (
      node: ForkData, 
      level: number = 0, 
      xPos: number = 0,
      parentId: string | null = null
    ) => {
      const id = `node-${nodeId++}`;
      
      flowNodes.push({
        id,
        data: { 
          label: node.fullName, 
          url: node.htmlUrl,
          isFork: node.isFork,
          isAncestor: node.isAncestor
        },
        position: { x: xPos, y: level * ySpacing },
        type: 'default',
        style: { 
          background: node.isAncestor ? '#3182CE' : (node.isFork ? '#4299e1' : '#48BB78'),
          color: 'white', 
          border: '1px solid #2b6cb0',
          width: 180,
          padding: '8px',
          borderRadius: '5px'
        }
      });
      
      nodePositions[node.fullName] = { id, x: xPos, y: level * ySpacing };
      
      if (parentId) {
        flowEdges.push({
          id: `edge-${parentId}-${id}`,
          source: parentId,
          target: id,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed }
        });
      }
      
      if (node.hasSubforks) {
        const children = Array.isArray(node.subForks) ? node.subForks : [node.subForks];
        
        const totalWidth = (children.length - 1) * xSpacing;
        const startX = xPos - totalWidth / 2;
        
        children.forEach((child, idx) => {
          const childXPos = startX + idx * xSpacing;
          processNode(child, level + 1, childXPos, id);
        });
      }
      
      yOffset = Math.max(yOffset, level * ySpacing);
    };
    
    data.forEach((rootNode, idx) => {
      processNode(rootNode, 0, idx * xSpacing * 2);
    });
    
    return { flowNodes, flowEdges };
  };

  const onNodeClick = (event: React.MouseEvent, node: Node<NodeData>) => {
    window.open(node.data.url, '_blank');
  };

  return (
    <div style={{ width: '100%', height: '800px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Controls />
        <Background color="#f8f8f8" gap={16} />
      </ReactFlow>
    </div>
  );
};

export default GitHubForkTree;