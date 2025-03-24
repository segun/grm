/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from "next";
import { Octokit } from "@octokit/rest";
import { ApiRequest } from "../types/github";
import { execSync } from "child_process";

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

      default:
        return res.status(400).json({ error: "Invalid action" });
    }

    return res.status(200).json(result.data);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
