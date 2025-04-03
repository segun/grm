/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextApiRequest, NextApiResponse } from "next";
import { Octokit } from "@octokit/rest";

// Configuration for pagination
const FORKS_PER_PAGE = 20;

// Define interface for fork tree node to fix the type error
interface ForkTreeNode {
  fullName: string;
  htmlUrl: string;
  owner: string;
  name: string;
  isFork: boolean;
  subForks: ForkTreeNode[];
  hasSubforks: boolean;
  hasNextPage?: boolean;
  currentPage?: number;
  isAncestor?: boolean;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const { action, owner, repo, query, page = 1, loadedNodes = [] } = req.body;

  // Helper function to recursively get all ancestors
  async function getAncestry(o: string, r: string): Promise<any[]> {
    try {
      const repoData = await octokit.repos.get({ owner: o, repo: r });
      
      // If it's a fork and has a parent, navigate up the chain
      if (repoData.data.fork && repoData.data.parent) {
        const parent = repoData.data.parent;
        const parentOwner = parent.owner.login;
        const parentName = parent.name;
        
        // Get the ancestry chain starting from the parent
        const parentChain = await getAncestry(parentOwner, parentName);
        return parentChain;
      }
      
      // If it's not a fork or has no parent data, this is the root repo
      // We return it only if it's not the same as the starting repo
      if (o.toLowerCase() !== repoData.data.owner.login.toLowerCase() || 
          r.toLowerCase() !== repoData.data.name.toLowerCase()) {
        return [{
          fullName: repoData.data.full_name,
          htmlUrl: repoData.data.html_url,
          owner: repoData.data.owner.login,
          name: repoData.data.name,
          isFork: false
        }];
      }
      
      // For the starting repo that's not a fork, return empty array
      // This prevents it from showing up twice in the lineage
      return [];
    } catch (error) {
      console.error("Error in getAncestry:", error);
      return [];
    }
  }

  // Helper function to get forks with pagination
  async function getForksPage(client: Octokit, o: string, r: string, page = 1, perPage = FORKS_PER_PAGE) {
    console.log(`Fetching forks for ${o}/${r} - page ${page}, per_page ${perPage}...`);
    try {
      const response = await client.repos.listForks({
        owner: o,
        repo: r,
        per_page: perPage,
        page: page
      });

      // Get total count from response headers
      const linkHeader = response.headers.link || '';
      const hasNextPage = linkHeader.includes('rel="next"');
      
      console.log(`Fetched page ${page} with ${response.data.length} forks. Has next page: ${hasNextPage}`);
      
      return {
        forks: response.data,
        hasNextPage
      };
    } catch (error) {
      console.error(`Error fetching forks for ${o}/${r}:`, error);
      return { forks: [], hasNextPage: false };
    }
  }

  // Helper function to get all forks (used for ancestry and other non-paginated operations)
  async function getAllForks(client: Octokit, o: string, r: string) {
    console.log(`Starting to fetch all forks for ${o}/${r}...`);
    const result = await client.paginate(client.repos.listForks, {
      owner: o,
      repo: r,
      per_page: FORKS_PER_PAGE
    }, (response) => {
      console.log(`Fetched page with ${response.data.length} forks`);
      return response.data;
    });
    console.log(`Finished fetching forks. Total: ${result.length}`);
    return result;
  }

  // Helper function to recursively build a fork tree with pagination support
  async function buildForkTree(
    o: string, 
    r: string, 
    depth = 0, 
    maxDepth = 2, 
    processedNodes: ForkTreeNode[] = [], 
    currentPage = 1
  ): Promise<ForkTreeNode> {
    console.log(`Building fork tree for ${o}/${r} at depth ${depth}, page ${currentPage}`);
    try {
      // Get current repository details
      const repoData = await octokit.repos.get({ owner: o, repo: r });
      
      // Find if this node was already processed
      const existingNodeIndex = processedNodes.findIndex(
        (node: any) => node.owner === o && node.name === r
      );
      
      // If we've already processed this node and have its forks, use that data
      if (existingNodeIndex !== -1) {
        console.log(`Using existing data for ${o}/${r}`);
        return processedNodes[existingNodeIndex];
      }
      
      // Get forks for current page
      const { forks, hasNextPage } = await getForksPage(octokit, o, r, currentPage);
      console.log(`Found ${forks.length} direct forks for ${o}/${r} on page ${currentPage}`);
      
      // Process all forks to get their subforks (but only if we're not at max depth)
      const processedForks: ForkTreeNode[] = [];
      if (depth < maxDepth) {
        for (const fork of forks) {
          const forkOwner = fork.owner.login;
          const forkName = fork.name;
          
          // Check if we've already processed this fork
          const existingForkIndex = processedNodes.findIndex(
            (node: any) => node.owner === forkOwner && node.name === forkName
          );
          
          let subForks;
          if (existingForkIndex !== -1) {
            // Use existing data if available
            subForks = processedNodes[existingForkIndex];
          } else {
            // Otherwise process new data
            subForks = await buildForkTree(forkOwner, forkName, depth + 1, maxDepth, processedNodes);
          }
          
          processedForks.push({
            fullName: fork.full_name,
            htmlUrl: fork.html_url,
            owner: forkOwner,
            name: forkName,
            isFork: fork.fork,
            subForks: subForks.subForks || [],
            hasSubforks: (subForks.subForks || []).length > 0,
            hasNextPage: subForks.hasNextPage
          });
        }
      } else {
        // At max depth, just add basic fork info without recursing
        for (const fork of forks) {
          processedForks.push({
            fullName: fork.full_name,
            htmlUrl: fork.html_url,
            owner: fork.owner.login,
            name: fork.name,
            isFork: fork.fork,
            subForks: [],
            hasSubforks: false
          });
        }
      }
      
      // Sort forks: those with subforks first, then those without
      const sortedForks = processedForks.sort((a, b) => {
        if (a.hasSubforks && !b.hasSubforks) return -1;
        if (!a.hasSubforks && b.hasSubforks) return 1;
        return 0;
      });
      
      // Return current repo with forks as subforks
      const result: ForkTreeNode = {
        fullName: repoData.data.full_name,
        htmlUrl: repoData.data.html_url,
        owner: o,
        name: r,
        isFork: repoData.data.fork,
        subForks: sortedForks,
        hasSubforks: sortedForks.length > 0,
        hasNextPage,
        currentPage
      };
      
      // Add this node to processed nodes
      if (existingNodeIndex !== -1) {
        processedNodes[existingNodeIndex] = result;
      } else {
        processedNodes.push(result);
      }
      
      return result;
    } catch (error) {
      console.error(`Error building fork tree for ${o}/${r}:`, error);
      return { 
        fullName: `${o}/${r}`, 
        htmlUrl: "", 
        owner: o, 
        name: r, 
        isFork: false, 
        subForks: [], 
        hasSubforks: false, 
        hasNextPage: false, 
        currentPage 
      };
    }
  }

  // Helper function to build the complete repository lineage with pagination
  async function getCompleteLineage(
    o: string, 
    r: string, 
    processedNodes: ForkTreeNode[] = [], 
    currentPage = 1
  ): Promise<ForkTreeNode[]> {
    console.log(`Building complete lineage for ${o}/${r}, page ${currentPage}`);
    
    try {
      // First, get the ancestry chain (excludes the current repo)
      const ancestry = await getAncestry(o, r);
      console.log(`Found ancestry chain with ${ancestry.length} repositories ${JSON.stringify(ancestry, null, 2)}`);
      
      // Build the fork tree from the current repository
      const currentRepoWithForks = await buildForkTree(o, r, 0, 2, processedNodes, currentPage);
      console.log(`Built fork tree from ${o}/${r} with ${currentRepoWithForks.subForks.length} direct forks`);
      
      // If no ancestors found, just return the current repo with its forks
      if (ancestry.length === 0) {
        return [currentRepoWithForks];
      }
      
      // Reverse the ancestry so oldest ancestors come first
      const reversedAncestry = [...ancestry].reverse();
      console.log(`Reversed ancestry chain`);
      
      // Convert ancestry items to have the same structure as fork items
      const ancestryNodes: ForkTreeNode[] = reversedAncestry.map((item, index) => ({
        ...item,
        subForks: [],
        hasSubforks: false,
        isAncestor: true,
        hasNextPage: false
      }));
      
      // Add the current repo as a subfork of the newest ancestor
      const newestAncestorIndex = ancestryNodes.length - 1;
      ancestryNodes[newestAncestorIndex].subForks = [currentRepoWithForks];
      ancestryNodes[newestAncestorIndex].hasSubforks = true;
      
      return ancestryNodes;
    } catch (error) {
      console.error("Error building complete lineage:", error);
      throw error;
    }
  }

  // Helper function to load more forks for a specific repository node
  async function loadMoreForks(
    o: string, 
    r: string, 
    page: number, 
    existingData: ForkTreeNode[]
  ): Promise<ForkTreeNode[]> {
    console.log(`Loading more forks for ${o}/${r}, page ${page}`);
    
    try {
      // Clone existing data to avoid mutation issues
      const clonedData = JSON.parse(JSON.stringify(existingData));
      
      // Helper function to find the target node and update it with new forks
      const findAndUpdateNode = async (nodes: ForkTreeNode[]): Promise<boolean> => {
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          
          // Check if this is the node we're looking for
          if (node.owner === o && node.name === r) {
            // Get the next page of forks
            const { forks, hasNextPage } = await getForksPage(octokit, o, r, page);
            console.log(`Found ${forks.length} more forks for ${o}/${r} on page ${page}`);
            
            // Process and add the new forks
            const newForks: ForkTreeNode[] = forks.map((fork: any) => ({
              fullName: fork.full_name,
              htmlUrl: fork.html_url,
              owner: fork.owner.login,
              name: fork.name,
              isFork: fork.fork,
              subForks: [],
              hasSubforks: false
            }));
            
            // Append new forks to existing ones
            node.subForks = [...node.subForks, ...newForks];
            node.hasSubforks = node.subForks.length > 0;
            node.hasNextPage = hasNextPage;
            node.currentPage = page;
            
            return true;
          }
          
          // Recursively check in subForks if this node has any
          if (node.subForks && node.subForks.length > 0) {
            const found = await findAndUpdateNode(node.subForks);
            if (found) return true;
          }
        }
        
        return false;
      };
      
      // Find and update the target node
      const nodeUpdated = await findAndUpdateNode(clonedData);
      
      if (!nodeUpdated) {
        throw new Error(`Node ${o}/${r} not found in existing data`);
      }
      
      return clonedData;
    } catch (error) {
      console.error(`Error loading more forks for ${o}/${r}:`, error);
      throw error;
    }
  }

  try {
    switch (action) {
      case "searchRepositories":
        console.log(`Processing searchRepositories request for query: ${query}`);
        const searchResult = await octokit.search.repos({
          q: query,
          per_page: FORKS_PER_PAGE
        });
        return res.status(200).json({ 
          items: searchResult.data.items.map((item: any) => ({
            id: item.id,
            full_name: item.full_name,
            owner: {
              login: item.owner.login
            },
            name: item.name
          }))
        });

      case "listForks":
        console.log(`Processing listForks request for ${owner}/${repo}`);
        const { forks, hasNextPage } = await getForksPage(octokit, owner, repo, page);
        console.log(`Processing ${forks.length} forks data`);
        const strippedForks = forks.map((fork: any) => ({
          fullName: fork.full_name,
          htmlUrl: fork.html_url,
          owner: fork.owner.login,
          name: fork.name,
          isFork: fork.fork
        }));
        return res.status(200).json({
          forks: strippedForks,
          hasNextPage,
          currentPage: page
        });

      case "getAncestry":
        const chain = await getAncestry(owner, repo);
        return res.status(200).json({ ancestry: chain });

      case "getFullForkTree":
        console.log(`Processing getFullForkTree request for ${owner}/${repo}`);
        const forkTree = await buildForkTree(owner, repo, 0, 2, loadedNodes, page);
        console.log(`Completed full fork tree for ${owner}/${repo}`);
        return res.status(200).json({ forkTree });

      case "getCompleteLineage":
        console.log(`Processing getCompleteLineage request for ${owner}/${repo}`);
        const completeLineage = await getCompleteLineage(owner, repo, loadedNodes, page);
        console.log(`Completed building lineage for ${owner}/${repo}`);
        return res.status(200).json({
          data: completeLineage,
          repoInfo: { owner, repo }
        });

      case "loadMoreForks":
        console.log(`Processing loadMoreForks request for ${owner}/${repo}, page ${page}`);
        const moreForksData = await loadMoreForks(owner, repo, page, loadedNodes);
        return res.status(200).json({
          data: moreForksData,
          repoInfo: { owner, repo }
        });

      default:
        return res.status(400).json({ error: "Invalid action" });
    }
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
