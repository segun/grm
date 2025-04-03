/* eslint-disable @typescript-eslint/no-explicit-any */
// import GitHubForkTree from "@/components/vertical-tree/GitHubForkTree";
import { useState, lazy, Suspense, useEffect, useRef } from "react";
import useDebounce from '../hooks/useDebounce';

// Lazy load the ReactFlow component to improve initial load time
const GitHubForkTree = lazy(() => import('../components/vertical-tree/GitHubForkTree'));

interface RepoSearchResult {
  id: number;
  full_name: string;
  owner: {
    login: string;
  };
  name: string;
}

// Function to parse GitHub URLs
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const urlObj = new URL(url);
    
    // Check if it's a GitHub URL
    if (!urlObj.hostname.includes('github.com')) {
      return null;
    }
    
    // Parse the pathname to extract owner and repo
    const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
    
    // GitHub repository URLs are in the format: github.com/:owner/:repo
    if (pathParts.length >= 2) {
      return {
        owner: pathParts[0],
        repo: pathParts[1]
      };
    }
    
    return null;
  } catch (error) {
    // If URL parsing fails, it's not a valid URL
    console.error("Invalid URL:", error); 
    return null;
  }
}

export default function ForkManager() {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [results, setResults] = useState<any>(null);
  const [action, setAction] = useState<"listForks" | "getAncestry" | "getFullForkTree" | "getCompleteLineage">("listForks");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RepoSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadedNodes, setLoadedNodes] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Use the debounce hook for search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Effect for searching repositories when debounced query changes
  useEffect(() => {
    // Skip search if the query appears to be a GitHub URL
    if (debouncedSearchQuery.startsWith('http') && parseGitHubUrl(debouncedSearchQuery)) {
      return;
    }
    
    if (debouncedSearchQuery.length >= 3) {
      searchRepositories(debouncedSearchQuery);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [debouncedSearchQuery]);

  async function handleSubmit() {
    setResults(null);
    setLoading(true);
    setCurrentPage(1);
    setLoadedNodes([]);
    
    try {
      const response = await fetch("/api/forks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action, 
          owner, 
          repo, 
          page: 1, 
          loadedNodes: [] 
        }),
      });
      const data = await response.json();
      setResults(data);
      
      // Store loaded nodes for potential "load more" requests
      if (action === "getCompleteLineage" && data.data) {
        setLoadedNodes(data.data);
      }
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadMore(targetOwner: string, targetRepo: string) {
    if (loadingMore) return;
    
    setLoadingMore(true);
    const nextPage = currentPage + 1;
    
    try {
      const response = await fetch("/api/forks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "loadMoreForks",
          owner: targetOwner,
          repo: targetRepo,
          page: nextPage,
          loadedNodes: loadedNodes
        }),
      });
      
      const data = await response.json();
      
      if (data.data) {
        setResults(data);
        setLoadedNodes(data.data);
        setCurrentPage(nextPage);
      }
    } catch (error) {
      console.error("Error loading more forks:", error);
    } finally {
      setLoadingMore(false);
    }
  }

  async function searchRepositories(query: string) {
    if (query.length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    
    setSearchLoading(true);
    try {
      const response = await fetch("/api/forks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "searchRepositories", query }),
      });
      const data = await response.json();
      setSearchResults(data.items || []);
      setShowDropdown(true);
    } catch (error) {
      console.error("Error searching repositories:", error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target.value;
    setSearchQuery(input);
    
    // Check if the input is a GitHub URL
    const githubData = parseGitHubUrl(input);
    if (githubData) {
      setOwner(githubData.owner);
      setRepo(githubData.repo);
      setShowDropdown(false); // Hide dropdown when URL is detected
    }
  }

  function handleRepoSelect(repo: RepoSearchResult) {
    setOwner(repo.owner.login);
    setRepo(repo.name);
    setSearchQuery(repo.full_name);
    setShowDropdown(false);
  }

  // Function to find nodes with more forks to load
  function findNodesWithMoreForks(nodes: any[]): { owner: string, repo: string, fullName: string }[] {
    const result: { owner: string, repo: string, fullName: string }[] = [];
    
    const checkNode = (node: any) => {
      if (node.hasNextPage) {
        result.push({
          owner: node.owner,
          repo: node.name,
          fullName: node.fullName
        });
      }
      
      if (node.subForks && node.subForks.length > 0) {
        node.subForks.forEach((subFork: any) => checkNode(subFork));
      }
    };
    
    nodes.forEach(node => checkNode(node));
    return result;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Fork Manager</h1>
      
      <div className="mb-4 relative" ref={dropdownRef}>
        <label className="block font-medium">Search Repository:</label>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Type at least 3 characters to search..."
            className="border p-2 w-full"
          />
          {searchLoading && (
            <svg className="animate-spin h-5 w-5 text-blue-600 absolute right-3 top-2.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
        </div>
        
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
            {searchResults.map((repo) => (
              <div 
                key={repo.id}
                className="p-2 hover:bg-gray-700 cursor-pointer border-b border-gray-700 text-white"
                onClick={() => handleRepoSelect(repo)}
              >
                <div className="font-semibold">{repo.full_name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="mb-4">
        <label className="block font-medium">Owner:</label>
        <input
          type="text"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="border p-2 w-full"
        />
      </div>
      <div className="mb-4">
        <label className="block font-medium">Repo:</label>
        <input
          type="text"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          className="border p-2 w-full"
        />
      </div>
      <div className="mb-4">
        <label className="block font-medium mb-2">Action:</label>
        <select value={action} onChange={(e) => setAction(e.target.value as any)} className="border p-2">
          <option value="listForks">List Forks</option>
          <option value="getAncestry">Get Ancestry</option>
          <option value="getFullForkTree">Get Full Fork Tree</option>
          <option value="getCompleteLineage">Complete Repository Lineage</option>
        </select>
      </div>
      <button 
        onClick={handleSubmit} 
        className="bg-blue-600 text-white px-4 py-2 rounded flex items-center"
        disabled={loading}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {loading ? 'Loading...' : 'Submit'}
      </button>
      {loading && <p className="mt-2 text-blue-600">Loading data, this may take a while for repositories with many forks...</p>}
      {results && action !== "getCompleteLineage" && (
        <div className="mt-4">
          <h2 className="text-xl font-bold mb-3">Results for: {action}</h2>
          <pre className="text-white bg-gray-700 p-2 text-xs overflow-auto max-h-[70vh]">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}
      {results && action === "getCompleteLineage" && (
        <div className="mt-4">
          <h2 className="text-xl font-bold mb-3">Repository Network Visualization</h2>
          <div className="mb-2 flex justify-between items-center">
            <span className="text-sm text-gray-500">
              Visualization shows ancestry chain and direct forks (max 100 per page)
            </span>
            <button
              onClick={() => {
                const showRaw = confirm("View raw JSON data instead?");
                if (showRaw) {
                  const jsonWindow = window.open("", "_blank");
                  if (jsonWindow) {
                    jsonWindow.document.write(`<pre>${JSON.stringify(results, null, 2)}</pre>`);
                  }
                }
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              View raw data
            </button>
          </div>
          
          {/* Load More section */}
          {results.data && (
            <div className="mb-4">
              {(() => {
                const nodesWithMoreForks = findNodesWithMoreForks(results.data);
                if (nodesWithMoreForks.length > 0) {
                  return (
                    <div className="bg-blue-50 p-3 rounded border border-blue-200">
                      <p className="text-sm text-blue-800 mb-2">
                        Some repositories have more forks that can be loaded:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {nodesWithMoreForks.map((node, index) => (
                          <button
                            key={index}
                            onClick={() => handleLoadMore(node.owner, node.repo)}
                            disabled={loadingMore}
                            className="bg-blue-600 text-white text-xs px-2 py-1 rounded flex items-center hover:bg-blue-700"
                          >
                            {loadingMore ? (
                              <>
                                <svg className="animate-spin mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Loading...
                              </>
                            ) : (
                              <>Load more from {node.fullName}</>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}
          
          <Suspense fallback={<div className="h-[70vh] bg-gray-50 flex items-center justify-center">Loading visualization...</div>}>
            <GitHubForkTree 
              treeData={results.data || []} 
              currentRepo={`${owner}/${repo}`} 
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
