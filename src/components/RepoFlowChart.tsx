/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Node,
  Edge,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";

// Custom node styles
const nodeStyles = {
  ancestor: {
    background: "#d0ebff",
    border: "1px solid #93c5fd",
    color: "#1e3a8a",
  },
  source: {
    background: "#bfdbfe",
    border: "2px solid #3b82f6",
    color: "#1e3a8a",
    fontWeight: "bold",
  },
  current: {
    background: "#e0f2fe",
    border: "2px solid #0ea5e9",
    color: "#0c4a6e",
    fontWeight: "bold",
  },
  fork: {
    background: "#f3f4f6",
    border: "1px solid #d1d5db",
    color: "#111827",
  },
  forkWithSubforks: {
    background: "#f0fdf4",
    border: "1px solid #86efac",
    color: "#166534",
  },
  childlessForks: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    color: "#374151",
    padding: "8px",
    textAlign: "center" as const,
    width: 200,
  },
};

// Improved tree layout function that creates a proper hierarchical structure
const createTreeLayout = (nodes: Node[], edges: Edge[]): Node[] => {
  // Build a graph representation
  const graph: Record<string, string[]> = {};
  const parents: Record<string, string> = {};
  const childCounts: Record<string, number> = {};
  
  // Initialize
  nodes.forEach(node => {
    graph[node.id] = [];
    childCounts[node.id] = 0;
  });
  
  // Build connections
  edges.forEach(edge => {
    if (graph[edge.source]) {
      graph[edge.source].push(edge.target);
      parents[edge.target] = edge.source;
      childCounts[edge.source] = (childCounts[edge.source] || 0) + 1;
    }
  });
  
  // Find root nodes (nodes without parents)
  const rootNodes = nodes
    .map(node => node.id)
    .filter(id => !parents[id]);
  
  if (rootNodes.length === 0) return nodes;
  
  // Width and height settings
  const NODE_WIDTH = 180;
  const LEVEL_HEIGHT = 100;
  const SIBLING_SPACING = 220;
  
  // Calculate node positions
  let maxWidth = 0;
  
  // For tracking subtree dimensions
  const subtreeWidths: Record<string, number> = {};
  
  // First pass: Calculate subtree widths
  const calculateSubtreeWidth = (nodeId: string): number => {
    const children = graph[nodeId] || [];
    
    if (children.length === 0) {
      subtreeWidths[nodeId] = NODE_WIDTH;
      return NODE_WIDTH;
    }
    
    let totalWidth = 0;
    children.forEach(childId => {
      totalWidth += calculateSubtreeWidth(childId);
    });
    
    // Add spacing between siblings
    totalWidth += Math.max(0, children.length - 1) * SIBLING_SPACING;
    
    // Store and return the calculated width
    subtreeWidths[nodeId] = Math.max(NODE_WIDTH, totalWidth);
    return subtreeWidths[nodeId];
  };
  
  // Calculate widths starting from root nodes
  rootNodes.forEach(rootId => {
    maxWidth += calculateSubtreeWidth(rootId);
  });
  
  // For tracking node positions
  const positions: Record<string, { x: number, y: number }> = {};
  
  // Second pass: Position nodes
  const positionSubtree = (nodeId: string, startX: number, level: number) => {
    const children = graph[nodeId] || [];
    
    // Position the current node
    const nodeWidth = subtreeWidths[nodeId];
    positions[nodeId] = {
      x: startX + nodeWidth / 2 - NODE_WIDTH / 2, 
      y: level * LEVEL_HEIGHT
    };
    
    // If no children, we're done
    if (children.length === 0) return;
    
    // Position children
    let childStartX = startX;
    children.forEach(childId => {
      const childWidth = subtreeWidths[childId];
      positionSubtree(childId, childStartX, level + 1);
      childStartX += childWidth + SIBLING_SPACING;
    });
  };
  
  // Position all subtrees
  let currentX = 0;
  rootNodes.forEach(rootId => {
    positionSubtree(rootId, currentX, 0);
    currentX += subtreeWidths[rootId] + SIBLING_SPACING * 2;
  });
  
  // Apply positions to nodes
  return nodes.map(node => ({
    ...node,
    position: positions[node.id] || { x: 0, y: 0 }
  }));
};

// Custom node component for childless forks group
const ChildlessForkGroup = ({ data }: { data: any }) => {
  const [expanded, setExpanded] = useState(false);
  const forkCount = data.forks.length;
  
  return (
    <div className="childless-forks" style={nodeStyles.childlessForks as any}>
      <div 
        className="cursor-pointer font-medium mb-1" 
        onClick={() => setExpanded(!expanded)}
      >
        {forkCount} Forks Without Children {expanded ? '▼' : '►'}
      </div>
      
      {expanded && (
        <div className="max-h-60 overflow-auto p-2 text-left border-t border-gray-200 mt-1">
          <ul className="list-disc pl-4">
            {data.forks.map((fork: any, i: number) => (
              <li key={i} className="text-sm mb-1">
                <a 
                  href={fork.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {fork.fullName}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Custom node component to render nodes with links
const NodeWithLink = ({ data }: { data: any }) => (
  <div>
    <a
      href={data.url}
      target="_blank"
      rel="noreferrer"
      className="hover:underline"
    >
      {data.label}
    </a>
  </div>
);

// Define nodeTypes outside of the component to avoid recreation on each render
const nodeTypes = {
  default: NodeWithLink,
  childlessForks: ChildlessForkGroup,
};

// Wrapper component that provides the ReactFlow context
const FlowWithProvider = ({ data }: { data: any[] }) => {
  // Create a reference to the ReactFlow instance
  const reactFlowInstance = useReactFlow();
  
  // Process data into nodes and edges for React Flow
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    // Track nodes by id to create edges later
    const nodeMap: Record<string, boolean> = {};
    
    // Find ancestry nodes and handle the new structure where current repo is in subForks
    const ancestryNodes = data.filter((item) => item.isAncestor);
    
    // Helper function to process a node's children recursively
    const processNode = (
      node: any,
      parentId: string | null = null,
      isCurrentRepo = false
    ) => {
      if (!node || !node.fullName) return; // Skip invalid nodes
      
      // Create a unique ID for each node
      const id = node.fullName.replace(/\//g, "_");
      
      // Skip if we've already processed this node
      if (nodeMap[id]) return;
      nodeMap[id] = true;
      
      // Determine node type
      let type = "fork";
      
      if (isCurrentRepo) {
        type = "current";
      } else if (node.hasSubforks) {
        type = "forkWithSubforks";
      }
      
      // Create node
      nodes.push({
        id,
        data: {
          label: node.fullName,
          url: node.htmlUrl,
          type,
        },
        position: { x: 0, y: 0 },
        style: {
          ...nodeStyles[type as keyof typeof nodeStyles],
          width: Math.max(150, node.fullName.length * 8),
          padding: 10,
          borderRadius: 5,
          fontSize: 14,
        },
      });
      
      if (!parentId || !id) {
        console.error("Invalid edge source/target:", { parentId, id });
        return;
      }
      // Create edge from parent to this node
      if (parentId) {
        const edgeId = `${parentId}->${id}`;
        edges.push({
          id: edgeId,
          source: parentId,
          target: id,
          type: 'smoothstep',
          animated: false,
          style: { 
            stroke: "#64748b", 
            strokeWidth: 2.5
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#64748b",
            width: 20,
            height: 20,
          },
          zIndex: 1000, // Ensure edges are rendered above nodes
        });
      }
      
      // Process subforks
      if (Array.isArray(node.subForks) && node.subForks.length > 0) {
        // Group childless forks
        const forksWithChildren = node.subForks.filter((f: any) => f && f.hasSubforks);
        const forksWithoutChildren = node.subForks.filter((f: any) => f && !f.hasSubforks);
        
        // Process forks with children
        forksWithChildren.forEach((fork: any) => {
          if (fork) processNode(fork, id);
        });
        
        // Add grouped node for forks without children if there are any
        if (forksWithoutChildren.length > 0) {
          const groupId = `childless-forks-${id}`;
          nodes.push({
            id: groupId,
            type: 'childlessForks',
            data: {
              forks: forksWithoutChildren,
              count: forksWithoutChildren.length,
            },
            position: { x: 0, y: 0 },
            style: {
              width: 250,
              padding: 0,
              borderRadius: 5,
            },
          });
          
          const edgeId = `${id}->${groupId}`;
          edges.push({
            id: edgeId,
            source: id,
            target: groupId,
            type: 'smoothstep',
            style: { stroke: "#64748b", strokeWidth: 2.5 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#64748b",
              width: 20,
              height: 20,
            },
            zIndex: 1000,
          });
        }
      } else if (typeof node.subForks === 'object' && node.subForks !== null) {
        // Handle the special case where subForks is an object (current repo)
        processNode(node.subForks, id, true);
      }
    };
    
    // Process ancestry chain first
    if (ancestryNodes.length > 0) {
      // Create nodes for all ancestors
      ancestryNodes.forEach((item, index) => {
        if (!item || !item.fullName) return; // Skip invalid items
        
        const id = item.fullName.replace(/\//g, "_");
        
        // Skip if we've already processed this node
        if (nodeMap[id]) return;
        nodeMap[id] = true;
        
        // Determine node type
        let type = "ancestor";
        if (index === 0) type = "source";
        
        // Create node
        nodes.push({
          id,
          data: {
            label: item.fullName,
            url: item.htmlUrl,
            type,
          },
          position: { x: 0, y: 0 },
          style: {
            ...nodeStyles[type as keyof typeof nodeStyles],
            width: Math.max(150, item.fullName.length * 8),
            padding: 10,
            borderRadius: 5,
            fontSize: 14,
          },
        });
        
        // Create edge from previous ancestor
        if (index > 0) {
          const prevId = ancestryNodes[index - 1].fullName.replace(/\//g, "_");
          const edgeId = `${prevId}->${id}`;
          edges.push({
            id: edgeId,
            source: prevId,
            target: id,
            type: 'smoothstep',
            animated: true,
            style: { 
              stroke: "#3b82f6", 
              strokeWidth: 3 
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#3b82f6",
              width: 20,
              height: 20,
            },
            zIndex: 1000, // Ensure edges are rendered above nodes
          });
        }
        
        // If this is the last ancestor, process its subforks
        // which includes the current repository
        if (index === ancestryNodes.length - 1 && item.subForks) {
          if (typeof item.subForks === 'object' && !Array.isArray(item.subForks)) {
            processNode(item.subForks, id, true);
          } else if (Array.isArray(item.subForks)) {
            item.subForks.forEach((fork: any) => {
              if (fork) processNode(fork, id);
            });
          }
        }
      });
    } else if (data.length > 0) {
      // If no ancestry, process the data directly - it should be a single node
      const rootNode = data[0];
      if (rootNode) processNode(rootNode, null, true);
    }
    
    return { initialNodes: nodes, initialEdges: edges };
  }, [data]);
  
  // Apply proper tree layout to the nodes
  const layoutedNodes = useMemo(() => {
    return createTreeLayout(initialNodes, initialEdges);
  }, [initialNodes, initialEdges]);
  
  console.log("Nodes:", initialNodes);
  console.log("Edges:", initialEdges);
  
  // Use React Flow hooks for nodes and edges
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Function to reset view and refresh edges
  const resetView = useCallback(() => {
    // Force edges to be recreated
    setEdges([...initialEdges]);
    
    setTimeout(() => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ padding: 0.2 });
      }
    }, 50);
  }, [initialEdges, reactFlowInstance, setEdges]);

  return (
    <div className="h-[70vh] border border-gray-200 bg-white relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes} // Use the nodeTypes defined outside the component
        fitView
        fitViewOptions={{ padding: 0.2 }}
        attributionPosition="bottom-right"
        defaultEdgeOptions={{
          type: 'smoothstep',  // Use smoothstep for better visibility
          style: { 
            stroke: '#64748b',
            strokeWidth: 2.5,
            zIndex: 1000, // Ensure edges are always on top
          },
          zIndex: 1000, // Ensure edges are always on top
        }}
        connectionLineStyle={{
          stroke: '#64748b',
          strokeWidth: 3,
        }}
        elementsSelectable={false}
        edgesFocusable={true}
        nodesDraggable={true}
        snapToGrid={true}
        snapGrid={[15, 15]}
        proOptions={{ hideAttribution: true }} // Remove attribution for cleaner view
      >
        <Controls />
        <MiniMap 
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
        <Background gap={12} size={1} color="#f1f5f9" />
        
        {/* Add panel for better controls */}
        <Panel position="top-right" className="mr-16 mt-28">
          <button 
            onClick={resetView}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-md text-sm font-medium transition-colors"
          >
            Reset View
          </button>
        </Panel>
      </ReactFlow>
      
      {/* Move legends outside of ReactFlow for better visibility */}
      <div className="absolute top-4 left-16 z-50">
        <div className="bg-white p-3 rounded-md border border-gray-300 shadow-md text-sm">
          <div className="font-medium mb-2 text-gray-800">Tree Structure</div>
          <div className="text-gray-700">
            Source repository at the top, forks branch downward
          </div>
        </div>
      </div>
      
      <div className="absolute top-4 right-16 z-50">
        <div className="bg-white p-3 rounded-md border border-gray-300 shadow-md text-sm">
          <div className="font-medium mb-2 text-gray-800">Node Types</div>
          <div className="flex items-center mb-2">
            <div style={{ ...nodeStyles.source, width: 20, height: 20, display: 'inline-block', marginRight: 8 }}></div>
            <span className="text-gray-700">Source Repository</span>
          </div>
          <div className="flex items-center mb-2">
            <div style={{ ...nodeStyles.current, width: 20, height: 20, display: 'inline-block', marginRight: 8 }}></div>
            <span className="text-gray-700">Current Repository</span>
          </div>
          <div className="flex items-center">
            <div style={{ ...nodeStyles.forkWithSubforks, width: 20, height: 20, display: 'inline-block', marginRight: 8 }}></div>
            <span className="text-gray-700">Forks with Children</span>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-16 left-16 z-50">
        <div className="bg-white p-3 rounded-md border border-gray-300 shadow-md text-sm">
          <div className="font-medium mb-2 text-gray-800">Edge Types</div>
          <div className="flex items-center mb-2">
            <div style={{ background: "#3b82f6", height: 6, width: 40, display: 'inline-block', marginRight: 8 }}></div>
            <span className="text-gray-700">Ancestry Connection</span>
          </div>
          <div className="flex items-center">
            <div style={{ background: "#64748b", height: 5, width: 40, display: 'inline-block', marginRight: 8 }}></div>
            <span className="text-gray-700">Fork Relationship</span>
          </div>
        </div>
      </div>
      
      {/* Replace the reset view button with the panel button above */}
      <div className="absolute bottom-4 right-16 z-50">
        <button 
          onClick={resetView}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-md text-sm font-medium transition-colors"
        >
          Reset View
        </button>
      </div>
    </div>
  );
};

// Main component that wraps the flow with the provider
const RepoFlowChart = ({ data }: { data: any[] }) => {
  return (
    <ReactFlowProvider>
      <FlowWithProvider data={data} />
    </ReactFlowProvider>
  );
};

export default RepoFlowChart;
