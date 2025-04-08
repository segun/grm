/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from "next";

interface Machine {
  id: string;
  name: string;
  state: string;
  region: string;
  created_at: string;
  updated_at: string;
  config: any;
  ips: {
    id: string;
    address: string;
    type: string;
  }[];
}

interface MachinesResponse {
  success: boolean;
  machines?: Machine[];
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MachinesResponse>
) {
  // Make sure FLY_API_TOKEN is configured
  if (!process.env.FLY_API_TOKEN) {
    return res.status(500).json({
      success: false,
      error: "FLY_API_TOKEN not configured",
    });
  }

  const action =
    (req.query.action as string) ||
    (req.method === "DELETE" ? "delete" : "list");
  const machineId = req.query.id as string;
  const appName = req.query.app as string;
  
  // Check if app name is provided
  if (!appName) {
    return res.status(400).json({
      success: false,
      error: "Application name is required",
    });
  }

  try {
    // Define common headers for all requests
    const headers = {
      Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
      "Content-Type": "application/json",
    };

    // List machines
    if (action === "list") {
      console.log(`Listing machines for app: ${appName}...`);

      const listResponse = await fetch(
        `https://api.machines.dev/v1/apps/${appName}/machines`,
        { headers }
      );

      if (!listResponse.ok) {
        const errorData = await listResponse.text();
        throw new Error(
          `Failed to list machines: ${listResponse.status} - ${errorData}`
        );
      }

      const machines = await listResponse.json();

      // For each machine, fetch its IPs
      for (const machine of machines) {
        const ipsResponse = await fetch(
          `https://api.machines.dev/v1/apps/${appName}/machines/${machine.id}/ips`,
          { headers }
        );

        if (ipsResponse.ok) {
          machine.ips = await ipsResponse.json();
        } else {
          machine.ips = [];
        }
      }

      return res.status(200).json({
        success: true,
        machines,
        message: `Found ${machines.length} machines`,
      });
    }

    // Stop a machine
    else if (action === "stop" && machineId) {
      console.log(`Stopping machine ${machineId} in app ${appName}...`);

      const stopResponse = await fetch(
        `https://api.machines.dev/v1/apps/${appName}/machines/${machineId}/stop`,
        {
          method: "POST",
          headers,
        }
      );

      if (!stopResponse.ok) {
        const errorData = await stopResponse.text();
        throw new Error(
          `Failed to stop machine: ${stopResponse.status} - ${errorData}`
        );
      }

      return res.status(200).json({
        success: true,
        message: `Machine ${machineId} stopped successfully`,
      });
    }

    // Start a machine
    else if (action === "start" && machineId) {
      console.log(`Starting machine ${machineId} in app ${appName}...`);

      const startResponse = await fetch(
        `https://api.machines.dev/v1/apps/${appName}/machines/${machineId}/start`,
        {
          method: "POST",
          headers,
        }
      );

      if (!startResponse.ok) {
        const errorData = await startResponse.text();
        throw new Error(
          `Failed to start machine: ${startResponse.status} - ${errorData}`
        );
      }

      return res.status(200).json({
        success: true,
        message: `Machine ${machineId} started successfully`,
      });
    }

    // Delete a machine (first stop then delete)
    else if ((action === "delete" || req.method === "DELETE") && machineId) {
      console.log(`Stopping machine ${machineId} in app ${appName} before deletion...`);
      const stopResponse = await fetch(
        `https://api.machines.dev/v1/apps/${appName}/machines/${machineId}/stop`,
        { method: "POST", headers }
      );

      if (!stopResponse.ok) {
        const errorData = await stopResponse.text();
        throw new Error(
          `Failed to stop machine before deletion: ${stopResponse.status} - ${errorData}`
        );
      }

      console.log(`Machine ${machineId} stopped. Now deleting...`, {
        stopResponse: await stopResponse.json(),
      });

      console.log(`Deleting machine ${machineId} in app ${appName}...`);
      const deleteResponse = await fetch(
        `https://api.machines.dev/v1/apps/${appName}/machines/${machineId}`,
        {
          method: "DELETE",
          headers,
        }
      );

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.text();
        throw new Error(
          `Failed to delete machine: ${deleteResponse.status} - ${errorData}`
        );
      }

      return res.status(200).json({
        success: true,
        message: `Machine ${machineId} stopped and deleted successfully`,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: "Invalid action or missing machine ID",
      });
    }
  } catch (error: any) {
    console.error("Error managing machines:", error);
    return res.status(500).json({
      success: false,
      error: `Error: ${error.message || "Unknown error"}`,
    });
  }
}
