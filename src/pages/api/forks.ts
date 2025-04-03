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
  isOwnedByUser?: boolean; // New property to track user ownership
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const { action, owner, repo, query, page = 1, loadedNodes = [] } = req.body;

  // New helper function to check if the authenticated user owns the repository
  async function isOwnedByUser(o: string): Promise<boolean> {
    try {
      // Get authenticated user info
      const { data: user } = await octokit.users.getAuthenticated();
      return user.login.toLowerCase() === o.toLowerCase();
    } catch (error) {
      console.error("Error checking repository ownership:", error);
      return false;
    }
  }

  // Helper function to recursively get all ancestors
  async function getAncestry(o: string, r: string): Promise<any[]> {
    try {
      console.log(`Getting ancestry for ${o}/${r}`);
      const repoData = await octokit.repos.get({ owner: o, repo: r });
      console.log(`Repository ${o}/${r} fork status: ${repoData.data.fork}`);
      
      // Enhanced debugging for parent detection
      if (repoData.data.fork) {
        // For forked repos, directly fetch the parent information
        try {
          const { data: repoDetails } = await octokit.request('GET /repos/{owner}/{repo}', {
            owner: o,
            repo: r
          });
          
          if (repoDetails.parent) {
            console.log(`Found parent for ${o}/${r}: ${repoDetails.parent.full_name}`);
            const parentOwner = repoDetails.parent.owner.login;
            const parentName = repoDetails.parent.name;
            
            // Create the immediate parent node
            const parentNode = {
              fullName: repoDetails.parent.full_name,
              htmlUrl: repoDetails.parent.html_url,
              owner: parentOwner,
              name: parentName,
              isFork: repoDetails.parent.fork
            };
            
            // Recursively get ancestors of the parent
            const parentAncestors = await getAncestry(parentOwner, parentName);
            
            // Return the parent and its ancestors
            return [...parentAncestors, parentNode];
          } else {
            console.log(`No parent found for ${o}/${r} despite being marked as a fork`);
          }
        } catch (error) {
          console.error(`Error fetching parent info for ${o}/${r}:`, error);
        }
      }
      
      return []; // Return empty array if no ancestors found or if this is the root repo
    } catch (error) {
      console.error(`Error in getAncestry for ${o}/${r}:`, error);
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
      
      // Check if this repo is owned by the authenticated user
      const ownedByUser = await isOwnedByUser(o);
      
      // Find if this node was already processed
      const existingNodeIndex = processedNodes.findIndex(
        (node: any) => node.owner === o && node.name === r
      );
      
      // If we've already processed this node and have its forks, use that data
      if (existingNodeIndex !== -1) {
        console.log(`Using existing data for ${o}/${r}`);
        // Update ownership information if it wasn't already set
        if (processedNodes[existingNodeIndex].isOwnedByUser === undefined) {
          processedNodes[existingNodeIndex].isOwnedByUser = ownedByUser;
        }
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
          
          // Check if the fork is owned by the user
          const forkOwnedByUser = await isOwnedByUser(forkOwner);
          
          processedForks.push({
            fullName: fork.full_name,
            htmlUrl: fork.html_url,
            owner: forkOwner,
            name: forkName,
            isFork: fork.fork,
            subForks: subForks.subForks || [],
            hasSubforks: (subForks.subForks || []).length > 0,
            hasNextPage: subForks.hasNextPage,
            isOwnedByUser: forkOwnedByUser
          });
        }
      } else {
        // At max depth, just add basic fork info without recursing
        for (const fork of forks) {
          // Check if the fork is owned by the user
          const forkOwnedByUser = await isOwnedByUser(fork.owner.login);
          
          processedForks.push({
            fullName: fork.full_name,
            htmlUrl: fork.html_url,
            owner: fork.owner.login,
            name: fork.name,
            isFork: fork.fork,
            subForks: [],
            hasSubforks: false,
            isOwnedByUser: forkOwnedByUser
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
        currentPage,
        isOwnedByUser: ownedByUser
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
        currentPage,
        isOwnedByUser: false
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
      // First, get the ancestry chain
      console.log(`Fetching ancestry for ${o}/${r}`);
      const ancestry = await getAncestry(o, r);
      console.log(`Found ancestry chain with ${ancestry.length} repositories:`);
      ancestry.forEach(anc => console.log(`- ${anc.fullName}`));
      
      // Build the fork tree from the current repository
      const currentRepoWithForks = await buildForkTree(o, r, 0, 2, processedNodes, currentPage);
      console.log(`Built fork tree from ${o}/${r} with ${currentRepoWithForks.subForks.length} direct forks`);
      
      // If no ancestors found, just return the current repo with its forks
      if (!ancestry.length) {
        console.log(`No ancestors found for ${o}/${r}, returning only the current repo`);
        return [currentRepoWithForks];
      }
      
      // Create a properly nested tree structure
      // We'll work backwards from the current repo up to the root
      
      // Start with the current repo
      let childNode = currentRepoWithForks;
      
      // Reverse the ancestry array to go from most recent ancestor to the root
      const reversedAncestry = [...ancestry].reverse();
      
      // Build the nested structure from the bottom up
      for (let i = 0; i < reversedAncestry.length; i++) {
        const ancestor = reversedAncestry[i];
        const isOwned = await isOwnedByUser(ancestor.owner);
        
        // Create the parent node
        const parentNode: ForkTreeNode = {
          fullName: ancestor.fullName,
          htmlUrl: ancestor.htmlUrl,
          owner: ancestor.owner,
          name: ancestor.name,
          isFork: !!ancestor.isFork,
          subForks: [childNode], // Add the child as a subfork
          hasSubforks: true,     // It has at least one subfork (the child)
          isAncestor: true,
          isOwnedByUser: isOwned
        };
        
        // This parent becomes the child for the next iteration
        childNode = parentNode;
      }
      
      // By now, childNode is actually the root of our tree
      // We return it as a single-item array
      console.log(`Returning hierarchical lineage with root: ${childNode.fullName}`);
      return [childNode];
    } catch (error) {
      console.error(`Error building complete lineage for ${o}/${r}:`, error);
      // Return just the current repo if there's an error with ancestry
      const currentRepo = await buildForkTree(o, r, 0, 2, processedNodes, currentPage);
      return [currentRepo];
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
            
            // Process forks and check ownership (using Promise.all to handle async)
            const newForksPromises = forks.map(async (fork: any) => {
              const isOwned = await isOwnedByUser(fork.owner.login);
              return {
                fullName: fork.full_name,
                htmlUrl: fork.html_url,
                owner: fork.owner.login,
                name: fork.name,
                isFork: fork.fork,
                subForks: [],
                hasSubforks: false,
                isOwnedByUser: isOwned
              };
            });
            
            // Resolve all promises
            const newForks: ForkTreeNode[] = await Promise.all(newForksPromises);
            
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
        
        // Check ownership for each fork (using Promise.all correctly with async function)
        const forksWithOwnershipPromises = forks.map(async (fork: any) => {
          const isOwned = await isOwnedByUser(fork.owner.login);
          return {
            fullName: fork.full_name,
            htmlUrl: fork.html_url,
            owner: fork.owner.login,
            name: fork.name,
            isFork: fork.fork,
            isOwnedByUser: isOwned
          };
        });
        
        const forksWithOwnership = await Promise.all(forksWithOwnershipPromises);
        
        return res.status(200).json({
          forks: forksWithOwnership,
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
