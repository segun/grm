import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { GitHubFile } from "@/pages/types/github";

interface TextEditorProps {
  onSave: (filename: string, content: string, sha?: string) => Promise<void>;
  files: GitHubFile[];
}

export default function TextEditor({ onSave, files }: TextEditorProps) {
  const [filename, setFilename] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<GitHubFile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [language, setLanguage] = useState<string>("plaintext");
  const [fileSha, setFileSha] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (selectedFile) {
      fetchFileContent(selectedFile);
    }
  }, [selectedFile]);

  function extractGitHubInfo(url: string) {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)/);
    return match ? { owner: match[1], repo: match[2], branch: match[3] } : null;
  }

  async function fetchFileContent(file: GitHubFile) {
    if (file.type === "dir") return;

    try {
      setIsLoading(true);
      const { owner, repo } = extractGitHubInfo(file.html_url) || {};
      const requestData = {
        action: "getContent",
        owner,
        repo,
        path: file.path,
      };

      console.log("Fetching file content", requestData);

      const response = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) throw new Error("Failed to fetch file content");
      const data: GitHubFile = await response.json();

      if (data.content && data.encoding === "base64") {
        const decoded = atob(data.content);
        setContent(decoded);
        setFilename(file.name);
        setLanguage(detectLanguage(file.name));
        setFileSha(data.sha); // Store the file SHA
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  function detectLanguage(filename: string): string {
    const extension = filename.split(".").pop()?.toLowerCase() || "";

    const languageMap: Record<string, string> = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      html: "html",
      css: "css",
      json: "json",
      md: "markdown",
      py: "python",
      java: "java",
      c: "c",
      cpp: "cpp",
      go: "go",
      rb: "ruby",
      php: "php",
      sh: "shell",
      yaml: "yaml",
      yml: "yaml",
    };

    return languageMap[extension] || "plaintext";
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSave(filename, content, fileSha); // Pass the sha when saving
    if (!selectedFile) {
      setFilename("");
      setContent("");
      setFileSha(undefined);
    }
  }

  function handleCreateNewFile() {
    setSelectedFile(null);
    setFilename("");
    setContent("");
    setLanguage("plaintext");
    setFileSha(undefined);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col md:flex-row gap-4 h-full">
        <div className="md:w-1/4 border rounded p-3 shadow-sm bg-white">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-gray-500">Repository Files</h4>
            <button
              onClick={handleCreateNewFile}
              className="text-sm px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition"
            >
              New File
            </button>
          </div>

          <div className="overflow-y-auto max-h-96">
            {files.length > 0 ? (
              <ul className="divide-y">
                {files.map((file) => (
                  <li
                    key={file.sha}
                    className={`p-2 cursor-pointer hover:bg-gray-100 ${
                      selectedFile?.sha === file.sha ? "bg-blue-100" : ""
                    } rounded transition text-gray-500`}
                    onClick={() => setSelectedFile(file)}
                  >
                    <div className="flex items-center">
                      <span>{file.type === "dir" ? "📁" : "📄"}</span>
                      <span className="ml-2 truncate">{file.name}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <p>No files found.</p>
              </div>
            )}
          </div>
        </div>

        <div className="md:w-3/4 border rounded shadow-sm bg-gray flex flex-col">
          <form onSubmit={handleSubmit} className="h-full flex flex-col">
            <div className="flex items-center p-3 border-b">
              <input
                type="text"
                value={filename}
                onChange={(e) => {
                  setFilename(e.target.value);
                  setLanguage(detectLanguage(e.target.value));
                }}
                placeholder="Enter filename"
                className="border px-3 py-1.5 w-full rounded text-gray-500"
                required
              />
              <button
                type="submit"
                className="ml-2 bg-blue-500 text-white px-4 py-1.5 rounded hover:bg-blue-600 transition disabled:opacity-50"
                disabled={isLoading}
              >
                Save
              </button>
            </div>
            <div className="flex-grow relative p-3">
              <Editor
                height="100%"
                language={language}
                value={content}
                onChange={(value) => setContent(value || "")}
                theme="vs-dark"
                options={{ minimap: { enabled: true }, scrollBeyondLastLine: false, fontSize: 14, wordWrap: "on", automaticLayout: true }}
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
