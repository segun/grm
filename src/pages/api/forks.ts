/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextApiRequest, NextApiResponse } from "next";
import { Octokit } from "@octokit/rest";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const { action, owner, repo } = req.body;

  // Helper function to recursively get all ancestors
  async function getAncestry(o: string, r: string): Promise<any[]> {
    try {
      const repoData = await octokit.repos.get({ owner: o, repo: r });
      
      // Check if this is the original repository (not a fork)
      if (!repoData.data.fork) {
        return [
          {
            fullName: repoData.data.full_name,
            htmlUrl: repoData.data.html_url,
            owner: o,
            name: r,
            isFork: false
          }
        ];
      }
      
      // If it's a fork and has a parent
      if (repoData.data.parent) {
        const parent = repoData.data.parent;
        const parentOwner = parent.owner.login;
        const parentName = parent.name;
        
        // Get the ancestry chain starting from the parent
        const parentChain = await getAncestry(parentOwner, parentName);
        
        // Return only the parent chain (excluding the current repository)
        return parentChain;
      }
      
      // In case it's marked as fork but has no parent data
      return [];
    } catch (error) {
      console.error("Error in getAncestry:", error);
      return [];
    }
  }

  // Helper function to get all forks
  async function getAllForks(client: Octokit, o: string, r: string) {
    console.log(`Starting to fetch forks for ${o}/${r}...`);
    const result = await client.paginate(client.repos.listForks, {
      owner: o,
      repo: r,
      per_page: 100
    }, (response) => {
      console.log(`Fetched page with ${response.data.length} forks`);
      return response.data;
    });
    console.log(`Finished fetching forks. Total: ${result.length}`);
    return result;
  }

  // Helper function to recursively build a fork tree
  async function buildForkTree(o: string, r: string, depth = 0): Promise<any> {
    console.log(`Building fork tree for ${o}/${r} at depth ${depth}`);
    try {
      // Get current repository details
      const repoData = await octokit.repos.get({ owner: o, repo: r });
      
      const forks = await getAllForks(octokit, o, r);
      console.log(`Found ${forks.length} direct forks for ${o}/${r}`);
      
      // Process all forks to get their subforks
      const processedForks = await Promise.all(
        forks.map(async (fork: any) => {
          const forkOwner = fork.owner.login;
          const forkName = fork.name;
          
          const subForks = await buildForkTree(forkOwner, forkName, depth + 1);
          
          return {
            fullName: fork.full_name,
            htmlUrl: fork.html_url,
            owner: forkOwner,
            name: forkName,
            isFork: fork.fork,
            subForks: subForks.subForks || [],
            hasSubforks: (subForks.subForks || []).length > 0
          };
        })
      );
      
      // Sort forks: those with subforks first, then those without
      const sortedForks = processedForks.sort((a, b) => {
        if (a.hasSubforks && !b.hasSubforks) return -1;
        if (!a.hasSubforks && b.hasSubforks) return 1;
        return 0;
      });
      
      // Return current repo with forks as subforks
      return {
        fullName: repoData.data.full_name,
        htmlUrl: repoData.data.html_url,
        owner: o,
        name: r,
        isFork: repoData.data.fork,
        subForks: sortedForks,
        hasSubforks: sortedForks.length > 0
      };
    } catch (error) {
      console.error(`Error building fork tree for ${o}/${r}:`, error);
      return { subForks: [] };
    }
  }

  // Helper function to build the complete repository lineage
  async function getCompleteLineage(o: string, r: string): Promise<any> {
    console.log(`Building complete lineage for ${o}/${r}`);
    
    try {
      // First, get the ancestry chain
      const ancestry = await getAncestry(o, r);
      console.log(`Found ancestry chain with ${ancestry.length} repositories ${JSON.stringify(ancestry, null, 2)}`);
      
      // Reverse the ancestry so oldest ancestors come first
      const reversedAncestry = [...ancestry].reverse();
      console.log(`Reversed ancestry chain`);
      
      // Build the fork tree from the current repository
      const currentRepoWithForks = await buildForkTree(o, r);
      console.log(`Built fork tree from ${o}/${r} with ${currentRepoWithForks.subForks.length} direct forks`);
      
      // Convert ancestry items to have the same structure as fork items
      const ancestryNodes = reversedAncestry.map((item, index) => ({
        ...item,
        subForks: [],
        hasSubforks: false,
        isAncestor: true
      }));
      
      // If we have ancestry nodes, add the forks to the newest ancestor (last one)
      if (ancestryNodes.length > 0) {
        const newestAncestorIndex = ancestryNodes.length - 1;
        ancestryNodes[newestAncestorIndex].subForks = currentRepoWithForks;
        ancestryNodes[newestAncestorIndex].hasSubforks = true;
        return ancestryNodes;
      } else {
        // If no ancestors, just return the current repo with its forks
        return [currentRepoWithForks];
      }
    } catch (error) {
      console.error("Error building complete lineage:", error);
      throw error;
    }
  }

  try {
    switch (action) {
      case "listForks":
        console.log(`Processing listForks request for ${owner}/${repo}`);
        const forks = await getAllForks(octokit, owner, repo);
        console.log(`Processing ${forks.length} forks data`);
        const strippedForks = forks.map((fork: any) => ({
          fullName: fork.full_name,
          htmlUrl: fork.html_url,
          owner: fork.owner.login,
          name: fork.name,
          isFork: fork.fork
        }));
        return res.status(200).json(strippedForks);

      case "getAncestry":
        const chain = await getAncestry(owner, repo);
        return res.status(200).json({ ancestry: chain });

      case "getFullForkTree":
        console.log(`Processing getFullForkTree request for ${owner}/${repo}`);
        const forkTree = await buildForkTree(owner, repo);
        console.log(`Completed full fork tree for ${owner}/${repo}`);
        return res.status(200).json({ forkTree });

      case "getCompleteLineage":
        console.log(`Processing getCompleteLineage request for ${owner}/${repo}`);
        const completeLineage = await getCompleteLineage(owner, repo);
        console.log(`Completed building lineage for ${owner}/${repo}`);
        return res.status(200).json(completeLineage);

      default:
        return res.status(400).json({ error: "Invalid action" });
    }
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
