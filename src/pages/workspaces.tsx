import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

interface Machine {
  id: string;
  name: string;
  state: string;
  region: string;
  created_at: string;
  ips: {
    id: string;
    address: string;
    type: string;
  }[];
}

export default function Workspaces() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [appName, setAppName] = useState('');

  const fetchMachines = async () => {
    if (!appName.trim()) {
      toast.error("Please enter an application name");
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/machines?action=list&app=${appName}`);
      const data = await response.json();
      
      if (data.success) {
        setMachines(data.machines || []);
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (error) {
      toast.error(`Failed to fetch machines: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMachineAction = async (action: string, machineId: string) => {
    setActionInProgress(machineId);
    try {
      const response = await fetch(`/api/machines?action=${action}&id=${machineId}&app=${appName}`, {
        method: action === 'delete' ? 'DELETE' : 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(data.message);
        // Refresh the machine list
        fetchMachines();
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (error) {
      toast.error(`Failed to ${action} machine: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'started':
        return 'text-green-600';
      case 'stopped':
        return 'text-red-600';
      case 'destroying':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  const getIpAddresses = (machine: Machine) => {
    if (!machine.ips || machine.ips.length === 0) {
      return <span className="text-gray-500">No IP addresses</span>;
    }
    
    return (
      <div>
        {machine.ips.map(ip => (
          <div key={ip.id} className="mb-1">
            <span className={`${ip.type === 'v4' ? 'text-blue-600' : 'text-purple-600'}`}>
              {ip.address} ({ip.type})
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Workspaces Manager</title>
      </Head>
      
      <main className="max-w-7xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Workspace Machines</h1>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            Back to Home
          </Link>
        </div>
        
        <div className="mb-6 flex items-center">
          <label htmlFor="appName" className="mr-2 text-gray-700 font-medium">Application Name:</label>
          <input
            id="appName"
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            className="px-3 py-2 border text-black border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter application name"
          />
          <button
            onClick={fetchMachines}
            disabled={loading}
            className="ml-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {loading ? 'Loading...' : 'Load Machines'}
          </button>
        </div>
        
        <div className="bg-black shadow-md rounded-lg overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-xl font-semibold">Your Machines</h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading machines...</p>
            </div>
          ) : machines.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">No machines found. {!appName.trim() && "Enter an application name and click 'Load Machines'."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name / ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Addresses</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {machines.map((machine) => (
                    <tr key={machine.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{machine.name}</div>
                        <div className="text-sm text-gray-500">{machine.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-sm rounded-full ${getStateColor(machine.state)} bg-opacity-10`}>
                          {machine.state}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {getIpAddresses(machine)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(machine.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {machine.state === 'started' ? (
                          <button
                            onClick={() => handleMachineAction('stop', machine.id)}
                            disabled={actionInProgress === machine.id}
                            className="text-yellow-600 hover:text-yellow-900 mr-4"
                          >
                            {actionInProgress === machine.id ? 'Working...' : 'Stop'}
                          </button>
                        ) : machine.state === 'stopped' ? (
                          <button
                            onClick={() => handleMachineAction('start', machine.id)}
                            disabled={actionInProgress === machine.id}
                            className="text-green-600 hover:text-green-900 mr-4"
                          >
                            {actionInProgress === machine.id ? 'Working...' : 'Start'}
                          </button>
                        ) : null}
                        
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete machine ${machine.name}?`)) {
                              handleMachineAction('delete', machine.id);
                            }
                          }}
                          disabled={actionInProgress === machine.id}
                          className="text-red-600 hover:text-red-900"
                        >
                          {actionInProgress === machine.id ? 'Working...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-8 bg-blue-50 rounded-lg p-4">
          <h3 className="text-lg font-medium text-blue-800 mb-2">About Workspaces</h3>
          <p className="text-blue-700">
            These are Fly.io machines that serve as remote development environments. Each workspace has its own SSH access and can be started, stopped, or deleted as needed.
          </p>
        </div>
      </main>
    </div>
  );
}
