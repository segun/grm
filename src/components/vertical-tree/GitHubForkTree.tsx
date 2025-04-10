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
import ReactMarkdown from 'react-markdown';
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
  isOwnedByUser?: boolean; // Add this new property
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
  isOwnedByUser?: boolean; // Add this new property
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
      padding: '12px',
      textAlign: 'center',
      width: 250,
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

  const handleForkClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering parent click handler
    window.open(data.url + '/fork', '_blank');
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering parent click handler
    window.open(data.url + '/edit/main', '_blank');
  };

  return (
    <div style={{ 
      background: data.isCurrentRepo ? '#F59E0B' : // Current repo color (amber)
               data.isRoot ? '#9333EA' :           // Root node color (purple)
               data.isAncestor ? '#3182CE' :       // Ancestor color (blue)
               (data.isFork ? '#4299e1' : '#48BB78'), // Other forks or repos
      color: 'white', 
      border: '1px solid #2b6cb0',
      padding: '12px',
      borderRadius: '5px',
      width: 250,
      position: 'relative'
    }}>
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{ background: '#fff', width: '8px', height: '8px' }}
      />
      
      <div style={{ marginBottom: '8px' }}>
        <div 
          onClick={fetchReadme} 
          style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>{data.label}</span>
          {loading ? <span>...</span> : (showReadme ? <span>▲</span> : <span>▼</span>)}
        </div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        {data.isOwnedByUser && (
          <button
            onClick={handleEditClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              background: '#ffffff',
              color: '#333',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" style={{ marginRight: '4px' }}>
              <path fillRule="evenodd" d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81l-6.286 6.287a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.249.249 0 00.108-.064l6.286-6.286z"></path>
            </svg>
            Edit
          </button>
        )}
        <button
          onClick={handleForkClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            background: '#ffffff',
            color: '#333',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" style={{ marginRight: '4px' }}>
            <path fillRule="evenodd" d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"></path>
          </svg>
          Fork
        </button>
      </div>
      
      {showReadme && readmeContent && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          zIndex: 1000,
          width: '500px',
          maxHeight: '500px',
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
          <div className="markdown-content" style={{ whiteSpace: 'normal' }}>
            <ReactMarkdown>
              {readmeContent}
            </ReactMarkdown>
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
    const xSpacing = 300; // Increased from 200 to provide more horizontal space
    const ySpacing = 150; // Increased from 100 to provide more vertical space
    
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
          repo: repo,
          isOwnedByUser: node.isOwnedByUser // Pass the ownership info to the node
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
      processNode(rootNode, 0, idx * xSpacing * 2.5, null, true); // Increased spacing between root nodes
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