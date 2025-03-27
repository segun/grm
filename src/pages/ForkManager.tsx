/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, lazy, Suspense } from "react";

// Lazy load the ReactFlow component to improve initial load time
const RepoFlowChart = lazy(() => import('../components/RepoFlowChart'));

export default function ForkManager() {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [results, setResults] = useState<any>(null);
  const [action, setAction] = useState<"listForks" | "getAncestry" | "getFullForkTree" | "getCompleteLineage">("listForks");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setResults(null);
    setLoading(true);
    try {
      const response = await fetch("/api/forks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, owner, repo }),
      });
      const data = await response.json();
      setResults(data);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Fork Manager</h1>
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
              Visualization shows ancestry chain and direct forks
            </span>
            <button
              onClick={() => {
                // Show raw JSON option
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
          <Suspense fallback={<div className="h-[70vh] bg-gray-50 flex items-center justify-center">Loading visualization...</div>}>
            <RepoFlowChart data={results} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
