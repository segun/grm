/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from "next";
import { Octokit } from "@octokit/rest";
import { ApiRequest } from "../types/github";
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).json({ error: "GitHub token not configured" });
  }

  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const { action, ...params } = req.body as ApiRequest;

  const githubToken = process.env.GITHUB_TOKEN;

  try {
    let result;

    switch (action) {
      case "getUserInfo":
        result = await octokit.users.getAuthenticated();
        break;

      case "listRepos":
        result = await octokit.repos.listForAuthenticatedUser({
          sort: "updated",
          per_page: 100,
        });
        return res.status(200).json(result.data);

      case "listBranches":
        result = await octokit.repos.listBranches({
          owner: params.owner,
          repo: params.repo,
        });
        return res.status(200).json(result.data);

      case "createRepo":
        result = await octokit.repos.createForAuthenticatedUser({
          name: params.name,
          description: params.description || "",
          private: params.private || false,
          auto_init: true,
        });
        break;

      case "getRepo":
        result = await octokit.repos.get({
          owner: params.owner,
          repo: params.repo,
        });

        console.log("Repo Data", JSON.stringify(result.data, null, 2));
        break;

      case "getForkInfo":
        // Get repository information including fork count and fork status
        const repoInfo = await octokit.repos.get({
          owner: params.owner,
          repo: params.repo,
        });
        
        // Helper function to recursively get all parent repositories
        async function getAncestry(owner: string, repo: string): Promise<any[]> {
          try {
            const repoData = await octokit.repos.get({ owner, repo });
            
            if (!repoData.data.fork) {
              return [
                {
                  fullName: repoData.data.full_name,
                  htmlUrl: repoData.data.html_url,
                  owner: repoData.data.owner.login,
                  name: repoData.data.name,
                  isFork: false
                }
              ];
            }
        
            // If it's a fork, handle the parent
            if (repoData.data.parent) {
              const parentIsFork = repoData.data.parent.fork;
              const parentInfo = {
                fullName: repoData.data.parent.full_name,
                htmlUrl: repoData.data.parent.html_url,
                owner: repoData.data.parent.owner.login,
                name: repoData.data.parent.name,
                isFork: parentIsFork
              };
        
              // If the parent is not a fork, just return its info
              if (!parentIsFork) {
                return [parentInfo];
              } else {
                // Recursively get the parent's ancestry
                const ancestors = await getAncestry(
                  repoData.data.parent.owner.login,
                  repoData.data.parent.name
                );
                return [parentInfo, ...ancestors];
              }
            }
        
            return [];
          } catch (error) {
            console.error("Error fetching ancestry:", error);
            return [];
          }
        }
        
        // Get all ancestors (parents) of this repository
        const ancestors = repoInfo.data.fork ? await getAncestry(params.owner, params.repo) : [];
        
        const forkInfo = {
          forkCount: repoInfo.data.forks_count,
          isFork: repoInfo.data.fork,
          // If it's a fork, the first ancestor is the immediate parent
          parent: ancestors.length > 0 ? ancestors[0] : null,
          // The last ancestor (if any) is the ultimate source
          source: ancestors.length > 0 ? ancestors[ancestors.length - 1] : null,
          // Include the full chain of ancestors
          ancestry: ancestors
        };
        
        result = { data: forkInfo };
        break;

      case "createFile":
        const content = Buffer.from(params.content).toString("base64");
        result = await octokit.repos.createOrUpdateFileContents({
          owner: params.owner,
          repo: params.repo,
          path: params.path,
          message: params.message || `Add ${params.path}`,
          content,
          branch: params.branch || "main",
          sha: params.sha || undefined,
        });
        break;

      case "getContent":
        console.log("Getting content", params);
        result = await octokit.repos.getContent({
          owner: params.owner,
          repo: params.repo,
          path: params.path,
          ref: params.ref || undefined,
        });
        break;

      case "createBranch":
        const { data: refData } = await octokit.git.getRef({
          owner: params.owner,
          repo: params.repo,
          ref: `heads/${params.baseBranch || "main"}`,
        });

        result = await octokit.git.createRef({
          owner: params.owner,
          repo: params.repo,
          ref: `refs/heads/${params.newBranch}`,
          sha: refData.object.sha,
        });
        break;
      case "forkRepo":
        const newRepo = await octokit.repos.createForAuthenticatedUser({
          name: params.forkName,
          description: params.description || "",
          private: params.private || false,
          auto_init: false, // Important: Do not auto-initialize!
        });

        console.log("New Repo Data", newRepo.data);

        const originalRepoUrl = `https://${githubToken}@github.com/${params.owner}/${params.repo}.git`;
        const newRepoUrl = `https://${githubToken}@github.com/${newRepo.data.owner.login}/${params.forkName}.git`;

        console.log(`🔄 Mirroring ${originalRepoUrl} to ${newRepoUrl}`);

        try {
          execSync(
            `
            rm -rf temp-repo &&
            git clone --bare ${originalRepoUrl} temp-repo &&
            cd temp-repo &&
            git push --mirror ${newRepoUrl} &&
            cd .. && rm -rf temp-repo
          `,
            { stdio: "inherit" }
          );

          console.log(
            `✅ Successfully duplicated ${params.owner}/${params.repo} to ${newRepo.data.full_name}`
          );
        } catch (error) {
          console.error("❌ Error during repository mirroring:", error);
          throw new Error("Error during repository mirroring");
        }

        result = newRepo;
        break;
      case "_forkRepo_":
        result = await octokit.repos.createFork({
          owner: params.owner,
          repo: params.repo,
          name: params.forkName,
          default_branch_only: false,
        });

        break;

      case "deploy":
        // Create a unique temporary directory
        const tempDir = path.join("/tmp", `deploy-${uuidv4()}`);
        const deployId = uuidv4().slice(0, 8);
        fs.mkdirSync(tempDir, { recursive: true });

        try {
          console.log(`🔄 Cloning repository for deployment to ${tempDir}`);

          // Clone the repository
          const repoUrl = `https://${githubToken}@github.com/${params.owner}/${params.repo}.git`;
          execSync(`git clone ${repoUrl} ${tempDir}`, { stdio: "pipe" });

          // Get the app name - using repo name as default if not provided
          const appName = params.appName || params.repo;

          // Create the deploy script in the temporary directory
          const deployScriptPath = path.join(tempDir, "deploy.sh");
          const logFilePath = path.join(tempDir, "deploy.log");
          
          const deployScript = `#!/bin/bash

export FLY_API_TOKEN="${process.env.FLY_API_TOKEN || "your-api-key-here"}"

# Ensure flyctl is installed
if ! command -v flyctl &> /dev/null; then
  curl -L https://fly.io/install.sh | sh
  export PATH="$HOME/.fly/bin:$PATH"
fi

# Deploy the app with the specified app name
flyctl launch --name ${appName} --no-deploy --now --region ord --yes
flyctl deploy -a ${appName} --remote-only

# Add completion marker to log
echo "DEPLOYMENT_COMPLETED" >> ${logFilePath}
`;

          // Write the script to the file
          fs.writeFileSync(deployScriptPath, deployScript);

          // Make the script executable
          execSync(`chmod +x ${deployScriptPath}`, { stdio: "pipe" });

          // Start deployment in the background
          console.log(`🚀 Starting deployment with ID: ${deployId}`);
          const deployProcess = spawn(`cd ${tempDir} && ./deploy.sh`, {
            shell: true,
            detached: true,
            stdio: ['ignore', fs.openSync(logFilePath, 'w'), fs.openSync(logFilePath, 'w')]
          });
          
          // Detach the process so it continues running in the background
          deployProcess.unref();

          // Initialize the log file with a started message
          fs.writeFileSync(logFilePath, `Deployment started at ${new Date().toISOString()}\n`);

          // Set up a cleanup process that runs after completion
          const cleanupScript = `
            while ! grep -q "DEPLOYMENT_COMPLETED" "${logFilePath}"; do
              sleep 10
            done
            echo "🧹 Cleaning up deployment files" >> "${logFilePath}"
            rm -rf "${tempDir}"
          `;
          
          const cleanupProcess = spawn('bash', ['-c', cleanupScript], {
            detached: true,
            stdio: 'ignore'
          });
          cleanupProcess.unref();

          result = {
            success: true,
            message: "Deployment started successfully",
            deployId: deployId,
            status: "running",
            logFile: logFilePath
          };
        } catch (deployError: any) {
          console.error("❌ Deployment setup error:", deployError);

          // Clean up if there's an error during setup
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
          } catch (cleanupError) {
            console.error(
              "Failed to clean up temporary directory:",
              cleanupError
            );
          }

          result = {
            success: false,
            message: "Deployment setup failed",
            error: deployError.message,
          };
        }
        break;

      case "listForks":
        result = await octokit.repos.listForks({
          owner: params.owner,
          repo: params.repo,
        });
        return res.status(200).json(result.data);

      default:
        return res.status(400).json({ error: "Invalid action" });
    }

    return res.status(200).json(result.data || result);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
