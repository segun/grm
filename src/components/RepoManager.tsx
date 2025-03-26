/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, FormEvent } from "react";
import TextEditor from "./TextEditor";
import {
  GitHubBranch,
  GitHubFile,
  GitHubRepo,
  GitHubUser,
} from "@/pages/types/github";

export default function RepoManager() {
  const [username, setUsername] = useState<string>("");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [currentRepo, setCurrentRepo] = useState<GitHubRepo | null>(null);
  const [files, setFiles] = useState<GitHubFile[]>([]);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>("main");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [deploymentStatus, setDeploymentStatus] = useState<{
    isDeploying: boolean;
    message: string;
    success?: boolean;
    output?: string;
  }>({
    isDeploying: false,
    message: "",
  });
  
  const [appName, setAppName] = useState<string>("");
  const [ancestry, setAncestry] = useState<any[] | null>(null);
  const [forks, setForks] = useState<any[]>([]);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  async function fetchUserInfo() {
    try {
      setLoading(true);
      const response = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getUserInfo" }),
      });

      if (!response.ok) throw new Error("Failed to fetch user info");
      const data: GitHubUser = await response.json();
      setUsername(data.login);
      await fetchRepos();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRepos() {
    try {
      setLoading(true);
      const response = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listRepos" }),
      });

      if (!response.ok) throw new Error("Failed to fetch repositories");
      const data: GitHubRepo[] = await response.json();
      setRepos(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function createRepo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const target = e.target as typeof e.target & {
      repoName: { value: string };
      isPrivate: { checked: boolean };
    };
    const repoName = target.repoName.value;
    const isPrivate = target.isPrivate.checked;

    try {
      setLoading(true);
      const response = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createRepo",
          name: repoName,
          private: isPrivate,
        }),
      });

      if (!response.ok) throw new Error("Failed to create repository");
      const data: GitHubRepo = await response.json();
      setRepos([...repos, data]);
      setCurrentRepo(data);
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function selectRepo(repo: GitHubRepo) {
    setCurrentRepo(repo);
    await fetchBranches(repo.owner.login, repo.name);
    await fetchFiles(repo.owner.login, repo.name, "main");
  }

  async function fetchBranches(owner: string, repo: string) {
    try {
      setLoading(true);
      const response = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "listBranches",
          owner,
          repo,
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch branches");
      const data: GitHubBranch[] = await response.json();
      setBranches(data);
      setCurrentBranch("main");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchFiles(owner: string, repo: string, branch: string) {
    try {
      setLoading(true);
      const response = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getContent",
          owner,
          repo,
          path: "",
          ref: branch,
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch files");
      const data: GitHubFile | GitHubFile[] = await response.json();
      setFiles(Array.isArray(data) ? data : [data]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function createBranch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const target = e.target as typeof e.target & {
      branchName: { value: string };
    };
    const newBranch = target.branchName.value;

    if (!currentRepo) return;

    try {
      setLoading(true);
      const response = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createBranch",
          owner: currentRepo.owner.login,
          repo: currentRepo.name,
          baseBranch: currentBranch,
          newBranch,
        }),
      });

      if (!response.ok) throw new Error("Failed to create branch");
      await fetchBranches(currentRepo.owner.login, currentRepo.name);
      setCurrentBranch(newBranch);
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function forkRepo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const target = e.target as typeof e.target & {
      forkName: { value: string };
    };
    const forkName = target.forkName.value;

    if (!currentRepo) return;

    try {
      setLoading(true);
      const response = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "forkRepo",
          owner: currentRepo.owner.login,
          repo: currentRepo.name,
          forkName,
        }),
      });

      if (!response.ok) throw new Error("Failed to fork repository");
      await fetchRepos();
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveFile(filename: string, content: string, sha?: string) {
    if (!currentRepo) return;

    try {
      setLoading(true);
      const response = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createFile",
          owner: currentRepo.owner.login,
          repo: currentRepo.name,
          path: filename,
          content,
          message: `Add/update ${filename}`,
          branch: currentBranch,
          sha,
        }),
      });

      if (!response.ok) throw new Error("Failed to create file");
      await fetchFiles(
        currentRepo.owner.login,
        currentRepo.name,
        currentBranch
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deployToFly() {
    if (!currentRepo) return;

    try {
      setDeploymentStatus({
        isDeploying: true,
        message: "Deploying to Fly.io...",
      });

      // Use the entered app name or default to repo name if empty
      const deployAppName = appName.trim() || currentRepo.name;

      const response = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deploy",
          owner: currentRepo.owner.login,
          repo: currentRepo.name,
          appName: deployAppName
        }),
      });

      if (!response.ok) throw new Error("Failed to deploy to Fly.io");
      const data = await response.json();
      
      setDeploymentStatus({
        isDeploying: false,
        message: data.message,
        success: data.success,
        output: data.output,
      });
    } catch (err: any) {
      setDeploymentStatus({
        isDeploying: false,
        message: `Error: ${err.message}`,
        success: false,
      });
      setError(err.message);
    }
  }

  async function fetchForkInfo() {
    if (!currentRepo) return;
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getForkInfo",
          owner: currentRepo.owner.login,
          repo: currentRepo.name,
        }),
      });
      if (!response.ok) throw new Error("Failed to fetch fork info");
      const data = await response.json();
      // Save the ancestry chain
      setAncestry(data.ancestry ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchForks() {
    if (!currentRepo) return;
    try {
      setLoading(true);
      const response = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "listForks",
          owner: currentRepo.owner.login,
          repo: currentRepo.name
        }),
      });
      if (!response.ok) throw new Error("Failed to list forks");
      const data = await response.json();
      setForks(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {error && (
        <div
          className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded shadow"
          role="alert"
        >
          <p className="font-bold text-lg">Error</p>
          <p className="text-base">{error}</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-1/3 bg-white border rounded-lg shadow-sm p-5">
          <h2 className="text-2xl font-bold mb-4 flex items-center text-gray-800">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 2H8.828a2 2 0 00-1.414.586L6.293 3.707A1 1 0 015.586 4H4zm6 9a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
            Repositories
          </h2>

          <div className="mb-5 p-5 bg-gray-50 rounded-lg border">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">
              Create New Repository
            </h3>
            <form onSubmit={createRepo}>
              <div className="mb-3">
                <label className="block text-base font-medium text-gray-700 mb-2">
                  Repository Name:
                </label>
                <input
                  type="text"
                  name="repoName"
                  required
                  className="text-gray-500 block w-full px-4 py-3 text-base border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="my-awesome-repo"
                />
              </div>
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="isPrivate"
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-base text-gray-700">
                    Private Repository
                  </span>
                </label>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 text-base rounded-md shadow-sm transition disabled:opacity-50"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Repository"}
              </button>
            </form>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-3 flex items-center text-gray-800">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
              </svg>
              Your Repositories:
            </h3>
            {loading && !repos.length ? (
              <div className="flex justify-center items-center p-8">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
              </div>
            ) : repos.length > 0 ? (
              <ul className="border rounded-md divide-y overflow-hidden text-gray-500">
                {repos.map((repo) => (
                  <li
                    key={repo.id}
                    className={`p-4 cursor-pointer transition ${
                      currentRepo?.id === repo.id
                        ? "bg-blue-50"
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => selectRepo(repo)}
                  >
                    <div className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-gray-500 mr-2 flex-shrink-0"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="font-medium text-base truncate mr-2">
                        {repo.name}
                      </span>
                      {repo.private && (
                        <span className="ml-auto flex-shrink-0 text-sm px-2 py-0.5 bg-gray-200 text-gray-800 rounded-full">
                          Private
                        </span>
                      )}
                    </div>
                    {currentRepo?.id === repo.id && (
                      <div className="mt-3 text-base bg-gray-100 p-3 rounded">
                        <p className="mb-1 text-gray-800 break-all">
                          <span className="font-medium">Clone URL:</span>
                          <code className="ml-1 text-sm bg-white px-2 py-1 rounded block mt-1 overflow-auto">
                            {repo.clone_url}
                          </code>
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-md">
                <p className="text-base">No repositories found.</p>
              </div>
            )}
          </div>
        </div>

        {currentRepo ? (
          <div className="lg:w-2/3 bg-white border rounded-lg shadow-sm p-5">
            <h2 className="text-2xl font-bold mb-4 flex items-center justify-between">
              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-gray-800">{currentRepo.name}</span>
              </div>
              <span className="text-base font-normal py-1 px-3 bg-blue-100 text-blue-800 rounded-full">
                Branch: {currentBranch}
              </span>
            </h2>

            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3 flex items-center text-gray-800">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Branches:
              </h3>
              {branches.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {branches.map((branch) => (
                    <button
                      key={branch.name}
                      onClick={() => {
                        setCurrentBranch(branch.name);
                        fetchFiles(
                          currentRepo.owner.login,
                          currentRepo.name,
                          branch.name
                        );
                      }}
                      className={`px-4 py-2 text-base rounded-full transition ${
                        currentBranch === branch.name
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                      }`}
                    >
                      {branch.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-3 bg-gray-50 rounded-md">
                  <p className="text-base text-gray-600">No branches found.</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 p-5 rounded-lg border">
                <h3 className="text-lg font-medium mb-3 text-gray-800">
                  Create Branch
                </h3>
                <form onSubmit={createBranch}>
                  <div className="mb-3">
                    <label className="block text-base font-medium text-gray-700 mb-2">
                      Branch Name:
                    </label>
                    <input
                      type="text"
                      name="branchName"
                      required
                      className="text-gray-500 block w-full px-4 py-3 text-base border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="feature/new-feature"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 text-base rounded-md shadow-sm transition disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? "Creating..." : "Create Branch"}
                  </button>
                </form>
              </div>

              <div className="bg-gray-50 p-5 rounded-lg border">
                <h3 className="text-lg font-medium mb-3 text-gray-800">
                  Fork Repository
                </h3>
                <form onSubmit={forkRepo}>
                  <div className="mb-3">
                    <label className="block text-base font-medium text-gray-700 mb-2">
                      Fork Name:
                    </label>
                    <input
                      type="text"
                      name="forkName"
                      required
                      className="text-gray-500 block w-full px-4 py-3 text-base border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="forked-repo"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 text-base rounded-md shadow-sm transition disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? "Forking..." : "Fork Repository"}
                  </button>
                </form>
              </div>
            </div>

            {/* Update the Deploy to Fly.io section */}
            <div className="bg-gray-50 p-5 rounded-lg border mb-6">
              <h3 className="text-lg font-medium mb-3 text-gray-800 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
                </svg>
                Deploy to Fly.io
              </h3>
              <div className="flex flex-col">
                <div className="mb-3">
                  <label className="block text-base font-medium text-gray-700 mb-2">
                    App Name: (defaults to repository name if empty)
                  </label>
                  <input
                    type="text"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    className="text-gray-500 block w-full px-4 py-3 text-base border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder={currentRepo.name}
                  />
                </div>
                <button
                  onClick={deployToFly}
                  disabled={deploymentStatus.isDeploying}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white py-3 px-4 text-base rounded-md shadow-sm transition disabled:opacity-50 mb-3"
                >
                  {deploymentStatus.isDeploying ? "Deploying..." : "Deploy to Fly.io"}
                </button>
                
                {deploymentStatus.message && (
                  <div className={`mt-3 p-4 rounded-md ${
                    deploymentStatus.success === undefined
                      ? "bg-gray-100"
                      : deploymentStatus.success
                      ? "bg-green-100"
                      : "bg-red-100"
                  }`}>
                    <p className={`font-medium ${
                      deploymentStatus.success === undefined
                        ? "text-gray-800"
                        : deploymentStatus.success
                        ? "text-green-800"
                        : "text-red-800"
                    }`}>
                      {deploymentStatus.message}
                    </p>
                    
                    {deploymentStatus.output && (
                      <div className="mt-2">
                        <p className="font-medium text-gray-700 mb-1">Deployment Output:</p>
                        <pre className="bg-black text-green-400 p-3 rounded-md text-sm overflow-auto max-h-40">
                          {deploymentStatus.output}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={fetchForkInfo}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md"
            >
              Get Ancestry
            </button>

            {ancestry && ancestry.length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 border rounded text-zinc-700">
                <h3 className="text-lg font-medium mb-2">Ancestry:</h3>
                <ul className="list-disc list-inside pl-5">
                  {ancestry.map((parent, idx) => (
                    <li key={idx}>
                      <a
                        href={parent.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {parent.fullName}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button onClick={fetchForks} className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md">
              Show Forks
            </button>

            {forks.length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 border rounded">
                <h3 className="text-lg font-medium mb-2">Forks:</h3>
                <ul className="list-disc list-inside pl-5">
                  {forks.map((fork: any) => (
                    <li key={fork.id}>
                      {fork.full_name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="h-[600px]">
              <h3 className="text-lg font-medium mb-3 flex items-center text-gray-800">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                  <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
                Files and Editor:
              </h3>
              <div className="border rounded-lg h-full shadow-inner">
                <TextEditor onSave={saveFile} files={files} />
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:w-2/3 bg-white border rounded-lg shadow-sm p-10 flex items-center justify-center">
            <div className="text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-20 w-20 text-gray-300 mx-auto mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                No repository selected
              </h3>
              <p className="text-lg text-gray-600 mb-4">
                Please select a repository from the list to view and edit its
                files.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
