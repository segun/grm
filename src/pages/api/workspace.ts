/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from "next";
import { generateSSHKeys, storeKeys } from "../../libs/ssh";
import { launchMachine } from "../../libs/machine";
import { allocateIPAddress } from "../../libs/network";
import { createApplication } from "../../libs/application";

// Define interfaces for our responses
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WorkspaceResponse>
) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  // Make sure FLY_API_TOKEN is configured
  if (!process.env.FLY_API_TOKEN) {
    return res.status(500).json({
      success: false,
      error: "FLY_API_TOKEN not configured",
    });
  }

  // Read new fields from request body
  const { workspaceName, applicationName, organizationId } = req.body;
  if (!workspaceName || !applicationName || !organizationId) {
    return res.status(400).json({
      success: false,
      error: "Workspace name, application name, and organization ID are required",
    });
  }

  console.log("Starting workspace creation...", { workspaceName, applicationName, organizationId });

  try {
    // Step 0: Create application using Fly.io API
    const appCreationData = await createApplication(applicationName, organizationId);
    console.log("Application created:", appCreationData);

    // Generate a unique ID for this workspace
    const workspaceId = `ws-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    console.log(`Generated workspace ID: ${workspaceId}`);

    // Step 1: Generate SSH keys
    const { privateKey, publicKey } = generateSSHKeys(workspaceId);
    console.log("SSH keys generated");

    // Step 2: Launch machine via Fly.io API (pass application info as needed)
    const machineData = await launchMachine(workspaceId, publicKey, appCreationData);
    console.log("Machine launched. Machine ID:", machineData.id);

    // Step 3: Allocate IPv4 address via GraphQL API
    const ipv4Address = await allocateIPAddress(applicationName);
    console.log("IPv4 allocated:", ipv4Address);

    // Step 4: Store keys for future use
    storeKeys(workspaceId, privateKey, publicKey);
    console.log("SSH keys stored");

    // Return success response with debug info from steps 1 and 2
    return res.status(200).json({
      success: true,
      workspaceId,
      sshDetails: {
        host: ipv4Address,
        port: 2222,
        username: "vibecoder",
        privateKey,
      },
      message: ``,
    });
  } catch (error: any) {
    console.error("Error creating workspace:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to create workspace: ${error.message || "Unknown error"}`,
    });
  }
}
