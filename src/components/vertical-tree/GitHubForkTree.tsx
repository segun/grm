import React, { useEffect, useState, useCallback, useMemo } from 'react';
import ReactFlow, { 
  Node,
  Edge,
  Controls,
  Background,
  MarkerType,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
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
  forks?: ForkData[];
  count?: number;
  isRoot?: boolean;
  isCurrentRepo?: boolean;
  readmeContent?: string; // Added to store README content
  owner?: string; // Added to help with README fetching
  repo?: string; // Added to help with README fetching
}

interface GitHubForkTreeProps {
  treeData: ForkData[];
  currentRepo?: string; // New prop to identify the current repo
}

// Custom node component for childless forks group
const ChildlessForkGroup = ({ data }: { data: NodeData }) => {
  const [expanded, setExpanded] = useState(false);
  const forkCount = data.count || 0;
  
  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the click from triggering the parent node's click handler
    setExpanded(!expanded);
  };
  
  return (
    <div style={{ 
      background: '#f3f4f6',
      border: '1px solid #d1d5db',
      color: '#374151',
      padding: '8px',
      textAlign: 'center',
      width: 200,
      borderRadius: '5px',
      position: 'relative'
    }}>
      {/* Add target handle at the top of the node */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{ background: '#555', width: '8px', height: '8px' }}
      />
      
      <div 
        style={{ cursor: 'pointer', fontWeight: 500, marginBottom: '4px' }} 
        onClick={handleExpandClick}
      >
        {forkCount} Forks Without Children {expanded ? '▼' : '►'}
      </div>
      
      {expanded && data.forks && (
        <div style={{ 
          maxHeight: '240px', 
          overflow: 'auto', 
          padding: '8px', 
          textAlign: 'left', 
          borderTop: '1px solid #e5e7eb', 
          marginTop: '4px' 
        }}>
          <ul style={{ listStyleType: 'disc', paddingLeft: '16px' }}>
            {data.forks.map((fork, i) => (
              <li key={i} style={{ fontSize: '14px', marginBottom: '4px' }}>
                <a 
                  href={fork.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#2563eb', textDecoration: 'none' }}
                  onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
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

// Also create a custom node for the default nodes to ensure consistent handle positioning
const DefaultNode = ({ data }: { data: NodeData }) => {
  const [showReadme, setShowReadme] = useState(false);
  const [loading, setLoading] = useState(false);
  const [readmeContent, setReadmeContent] = useState<string | null>(null);

  // Function to fetch README content
  const fetchReadme = async () => {
    if (readmeContent !== null) {
      setShowReadme(!showReadme);
      return;
    }

    if (!data.owner || !data.repo) {
      const parts = data.label.split('/');
      if (parts.length !== 2) return;
    }

    setLoading(true);
    try {
      const owner = data.owner || data.label.split('/')[0];
      const repo = data.repo || data.label.split('/')[1];
      
      // Try different README filenames
      const fileNames = ['README.md', 'README', 'Readme.md', 'readme.md'];
      let content = null;
      
      for (const fileName of fileNames) {
        try {
          const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${fileName}`);
          if (response.ok) {
            const data = await response.json();
            // GitHub API returns content as base64 encoded
            content = atob(data.content);
            break;
          }
        } catch (err) {
          // Continue trying other README formats
          console.error(`Error fetching ${fileName}:`, err);
        }
      }
      
      setReadmeContent(content || "No README found");
      setShowReadme(true);
    } catch (error) {
      console.error("Error fetching README:", error);
      setReadmeContent("Failed to load README");
      setShowReadme(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      background: data.isCurrentRepo ? '#F59E0B' : // Current repo color (amber)
               data.isRoot ? '#9333EA' :           // Root node color (purple)
               data.isAncestor ? '#3182CE' :       // Ancestor color (blue)
               (data.isFork ? '#4299e1' : '#48BB78'), // Other forks or repos
      color: 'white', 
      border: '1px solid #2b6cb0',
      padding: '8px',
      borderRadius: '5px',
      width: 180,
      position: 'relative'
    }}>
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{ background: '#fff', width: '8px', height: '8px' }}
      />
      <div 
        onClick={fetchReadme} 
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>{data.label}</span>
        {loading ? <span>...</span> : (showReadme ? <span>▲</span> : <span>▼</span>)}
      </div>
      
      {showReadme && readmeContent && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          zIndex: 1000,
          width: '400px',
          maxHeight: '400px',
          overflowY: 'auto',
          background: 'white',
          color: 'black',
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '12px',
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
          marginTop: '8px',
          fontSize: '14px',
          lineHeight: '1.5'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ margin: 0 }}>README</h3>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowReadme(false);
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>
            {readmeContent}
          </div>
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ background: '#fff', width: '8px', height: '8px' }}
      />
    </div>
  );
};

const GitHubForkTree: React.FC<GitHubForkTreeProps> = ({ treeData, currentRepo }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Define node types
  const nodeTypes = useMemo(() => ({
    childlessForks: ChildlessForkGroup,
    defaultNode: DefaultNode,
  }), []);

  const processTreeData = useCallback((data: ForkData[]) => {
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
      parentId: string | null = null,
      isRoot: boolean = parentId === null // Root node if no parent ID
    ) => {
      const id = `node-${nodeId++}`;
      const parts = node.fullName.split('/');
      const owner = parts[0];
      const repo = parts[1];
      
      flowNodes.push({
        id,
        data: { 
          label: node.fullName, 
          url: node.htmlUrl,
          isFork: node.isFork,
          isAncestor: node.isAncestor,
          isRoot: isRoot, // Set root flag
          isCurrentRepo: currentRepo ? node.fullName === currentRepo : undefined, // Use ternary to ensure boolean | undefined
          owner: owner,
          repo: repo
        },
        position: { x: xPos, y: level * ySpacing },
        type: 'defaultNode', // Use our custom default node
      });
      
      nodePositions[node.fullName] = { id, x: xPos, y: level * ySpacing };
      
      if (parentId) {
        flowEdges.push({
          id: `edge-${parentId}-${id}`,
          source: parentId,
          target: id,
          sourceHandle: 'bottom', // Specify source handle
          targetHandle: 'top',    // Specify target handle
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed }
        });
      }
      
      if (node.hasSubforks) {
        const children = Array.isArray(node.subForks) ? node.subForks : [node.subForks];
        
        // Group childless forks
        const forksWithChildren = children.filter((f) => f && f.hasSubforks);
        const forksWithoutChildren = children.filter((f) => f && !f.hasSubforks);
        
        // Calculate total width for positioning
        const totalItems = forksWithChildren.length + (forksWithoutChildren.length === 1 ? 1 : (forksWithoutChildren.length > 1 ? 1 : 0));
        const totalWidth = (totalItems - 1) * xSpacing;
        const startX = xPos - totalWidth / 2;
        
        let currentIndex = 0;
        
        // Process forks with children
        forksWithChildren.forEach((child) => {
          const childXPos = startX + currentIndex * xSpacing;
          processNode(child, level + 1, childXPos, id, false); // Pass false for isRoot
          currentIndex++;
        });
        
        // Process forks without children
        if (forksWithoutChildren.length === 1) {
          // If only one childless fork, display it normally
          const childXPos = startX + currentIndex * xSpacing;
          processNode(forksWithoutChildren[0], level + 1, childXPos, id, false); // Pass false for isRoot
        } else if (forksWithoutChildren.length > 1) {
          // If multiple childless forks, group them
          const groupId = `childless-group-${nodeId++}`;
          const groupXPos = startX + currentIndex * xSpacing;
          
          flowNodes.push({
            id: groupId,
            type: 'childlessForks',
            data: {
              forks: forksWithoutChildren,
              count: forksWithoutChildren.length,
              label: `${forksWithoutChildren.length} Forks Without Children`,
              url: '',
              isFork: false
            },
            position: { x: groupXPos, y: (level + 1) * ySpacing },
          });
          
          flowEdges.push({
            id: `edge-${id}-${groupId}`,
            source: id,
            target: groupId,
            sourceHandle: 'bottom', // Specify source handle
            targetHandle: 'top',    // Specify target handle
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed }
          });
        }
      }
      
      yOffset = Math.max(yOffset, level * ySpacing);
    };
    
    data.forEach((rootNode, idx) => {
      processNode(rootNode, 0, idx * xSpacing * 2, null, true); // Root nodes pass true for isRoot
    });
    
    return { flowNodes, flowEdges };
  }, [currentRepo]); // Add currentRepo to dependencies

  useEffect(() => {
    const { flowNodes, flowEdges } = processTreeData(treeData);
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [treeData, processTreeData, setNodes, setEdges]);

  return (
    <div style={{ width: '100%', height: '800px', paddingLeft: '25px', paddingRight: '25px', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Controls />
        <Background gap={8} />
      </ReactFlow>
    </div>
  );
};

export default React.memo(GitHubForkTree);