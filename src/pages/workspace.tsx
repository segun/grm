/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface WorkspaceResponse {
  success: boolean;
  workspaceId?: string;
  sshDetails?: {
    host: string;
    port: number;
    username: string;
    privateKey: string;
  };
  message?: string;
  error?: string;
}

export default function WorkspacePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [applicationName, setApplicationName] = useState('');
  const [appExists, setAppExists] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(false);

  useEffect(() => {
    // Fetch organizations when component mounts
    const fetchOrganizations = async () => {
      setLoadingOrganizations(true);
      try {
        const response = await fetch('/api/organizations');
        const data = await response.json();
        if (data.success && data.organizations) {
          setOrganizations(data.organizations);
          if (data.organizations.length > 0) {
            setOrganizationId(data.organizations[0].id);
          }
        } else {
          setError(data.error || 'Failed to load organizations');
        }
      } catch (err) {
        console.error('Error fetching organizations:', err);
        setError('Failed to load organizations. Please try again.');
      } finally {
        setLoadingOrganizations(false);
      }
    };

    fetchOrganizations();
  }, []);

  useEffect(() => {
    // Debounce: wait 500ms after applicationName changes
    const timer = setTimeout(() => {
      if (applicationName.trim() !== '') {
        fetch(`/api/checkApplication?name=${encodeURIComponent(applicationName)}`)
          .then((res) => res.json())
          .then((data) => setAppExists(data.exists))
          .catch(() => setAppExists(false));
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [applicationName]);

  const handleCreateWorkspace = async () => {
    // Validate fields are filled and application does not already exist
    if (!workspaceName.trim() || !applicationName.trim() || !organizationId || appExists) return;
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceName, applicationName, organizationId }),
      });
      const data = await response.json();
      setWorkspace(data);
      console.log('Workspace created:', data);
    } catch (err: any) {
      console.error('Error creating workspace:', err);
      setError('Failed to create workspace');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(field);
        setTimeout(() => setCopied(null), 2000);
      },
      () => {
        setError('Failed to copy to clipboard');
      }
    );
  };

  const getSshCommand = () => {
    if (!workspace?.sshDetails) return '';
    
    return `ssh -i /path/to/saved/key ${workspace.sshDetails.username}@${workspace.sshDetails.host}`;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Workspace Creator</h1>
      
      {/* Input fields for workspace name, application name, and organization */}
      <div className="mb-4">
        <label className="block mb-1">Workspace Name</label>
        <input
          type="text"
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          className="border p-2 mb-2 w-full"
        />
        
        <label className="block mb-1">Application Name</label>
        <input
          type="text"
          value={applicationName}
          onChange={(e) => setApplicationName(e.target.value)}
          className="border p-2 mb-2 w-full"
        />
        {appExists && (
          <p className="mt-1 text-red-600 text-sm">
            Application already exists.
          </p>
        )}
        
        <label className="block mb-1">Organization</label>
        {loadingOrganizations ? (
          <div className="text-gray-500">Loading organizations...</div>
        ) : (
          <select
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            className="border p-2 w-full"
            disabled={organizations.length === 0}
          >
            {organizations.length === 0 ? (
              <option value="">No organizations available</option>
            ) : (
              organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))
            )}
          </select>
        )}
      </div>

      <div className="mb-4">
        <p className="mb-4">
          Create a new remote development workspace with SSH access.
        </p>
        
        <button 
          onClick={handleCreateWorkspace}
          disabled={isLoading || !workspaceName.trim() || !applicationName.trim() || !organizationId || appExists}
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating Workspace...
            </>
          ) : 'Create New Workspace'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {workspace?.success && workspace.sshDetails && (
        <div className="bg-gray-50 border rounded shadow mb-6">
          <div className="p-4">
            <h2 className="text-xl font-semibold text-blue-600 mb-2">
              Workspace Created Successfully
            </h2>
            
            <p className="mb-4 text-gray-800">
              Your workspace ID: <strong>{workspace.workspaceId}</strong>
            </p>

            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-1 text-gray-800">SSH Connection Details:</h3>
                <div className="flex items-center">
                  <input
                    type="text"
                    readOnly
                    value={getSshCommand()}
                    className="border p-2 flex-grow bg-white text-gray-800"
                  />
                  <button
                    onClick={() => copyToClipboard(getSshCommand(), 'sshCommand')}
                    className="ml-2 bg-blue-100 p-2 rounded hover:bg-blue-200 border border-blue-300 text-blue-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                      <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
                    </svg>
                  </button>
                </div>
                {copied === 'sshCommand' && (
                  <span className="text-sm text-green-600">Copied!</span>
                )}
              </div>

              <div>
                <h3 className="font-medium mb-1 text-gray-800">Host:</h3>
                <div className="flex items-center">
                  <input
                    type="text"
                    readOnly
                    value={workspace?.sshDetails?.host || ""}
                    className="border p-2 flex-grow bg-white text-gray-800"
                  />
                  <button
                    onClick={() => copyToClipboard(workspace?.sshDetails?.host || "", 'host')}
                    className="ml-2 bg-blue-100 p-2 rounded hover:bg-blue-200 border border-blue-300 text-blue-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                      <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
                    </svg>
                  </button>
                </div>
                {copied === 'host' && (
                  <span className="text-sm text-green-600">Copied!</span>
                )}
              </div>

              <div>
                <h3 className="font-medium mb-1 text-gray-800">Username:</h3>
                <div className="flex items-center">
                  <input
                    type="text"
                    readOnly
                    value={workspace?.sshDetails?.username || ""}
                    className="border p-2 flex-grow bg-white text-gray-800"
                  />
                  <button
                    onClick={() => copyToClipboard(workspace?.sshDetails?.username || "", 'username')}
                    className="ml-2 bg-blue-100 p-2 rounded hover:bg-blue-200 border border-blue-300 text-blue-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                      <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
                    </svg>
                  </button>
                </div>
                {copied === 'username' && (
                  <span className="text-sm text-green-600">Copied!</span>
                )}
              </div>

              <div>
                <h3 className="font-medium mb-1 text-gray-800">Private Key:</h3>
                <p className="text-sm text-gray-600 mb-2">
                  This private key is displayed only once. Save it to a file for connection.
                </p>
                <div className="flex items-start">
                  <textarea
                    readOnly
                    rows={8}
                    value={workspace?.sshDetails?.privateKey || ""}
                    className="border p-2 flex-grow font-mono text-sm bg-white text-gray-800"
                  />
                  <button
                    onClick={() => copyToClipboard(workspace?.sshDetails?.privateKey || "", 'privateKey')}
                    className="ml-2 bg-blue-100 p-2 rounded hover:bg-blue-200 border border-blue-300 text-blue-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                      <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
                    </svg>
                  </button>
                </div>
                {copied === 'privateKey' && (
                  <span className="text-sm text-green-600">Copied!</span>
                )}
              </div>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 mt-6">
              <p>
                To connect to your workspace, save the private key to a file, set its permissions to 600 
                (chmod 600 privatekey.pem), and use the SSH command above.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
