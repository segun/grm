/* eslint-disable @typescript-eslint/no-explicit-any */
// Replace the import that can't be found
import { validateApiToken } from "../utils";

export async function createMachine(workspaceId: string, appName: string): Promise<any> {
  validateApiToken();
  
  const createMachineRequest = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: workspaceId,
      config: {
        image: "aardvocate/ubuntu-ssh-nodejs:latest",
        env: { FLY_MACHINE_ID: workspaceId },
        guest: { cpu_kind: "shared", cpus: 1, memory_mb: 1024 },
        services: [
          {
            ports: [
              {
                port: 2222,
              },
            ],
            protocol: "tcp",
            internal_port: 2222,
          },
        ],
      },
      region: "ord",
    }),
  };

  const createResponse = await fetch(
    `https://api.machines.dev/v1/apps/${appName}/machines`,
    createMachineRequest
  );
  if (!createResponse.ok) {
    const errorData = await createResponse.json();
    throw new Error(
      `Fly.io API error creating machine: ${
        createResponse.status
      } - ${JSON.stringify(errorData)}`
    );
  }
  return await createResponse.json();
}

async function execCommandOnFlyMachine(machineId: string, publicKey: string, appName: string) {
  validateApiToken();
  
  const cmd = [
    "/bin/sh",
    "-c",
    `mkdir -p /home/vibecoder/.ssh && printf '%s' "${publicKey}" > /home/vibecoder/.ssh/authorized_keys && chmod 700 /home/vibecoder/.ssh && chmod 600 /home/vibecoder/.ssh/authorized_keys && chown -R vibecoder:vibecoder /home/vibecoder/.ssh && /usr/sbin/sshd -D`
  ];

  const response = await fetch(
    `https://api.machines.dev/v1/apps/${appName}/machines/${machineId}/exec`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        command: cmd,
        env: {},
        timeout: 60,
      }),
    }
  );

  if (!response.ok) {
    console.log(`Failed to execute command: ${response}`);
    const errorText = await response.text();
    throw new Error(`Failed to execute command: ${errorText}`);
  }

  return await response.json();
}

export async function getMachineStatus(machineId: string, appName: string): Promise<any> {
  validateApiToken();
  
  const response = await fetch(
    `https://api.machines.dev/v1/apps/${appName}/machines/${machineId}`,
    {
      headers: { Authorization: `Bearer ${process.env.FLY_API_TOKEN}` },
    }
  );
  if (!response.ok) {
    // Handle 404 specifically as potentially recoverable (machine just created)
    if (response.status === 404) {
      console.warn(`Machine ${machineId} not found yet (status 404).`);
      return { state: "not_found" };
    }
    const errorData = await response.text();
    throw new Error(
      `Failed to get machine status ${machineId}: ${response.status} - ${errorData}`
    );
  }
  return await response.json();
}

export async function launchMachine(
  workspaceId: string,
  publicKey: string,
  appCreationData?: any
): Promise<any> {
  validateApiToken();
  
  if (appCreationData) {
    console.log("launchMachine received application data:", appCreationData);
  }
  
  const appName = appCreationData?.name || "vibecoder";
  
  // 1. Create machine
  const machine = await createMachine(workspaceId, appName);
  console.log(`Machine created with ID: ${machine.id}`);

  // 2. Wait for machine to be 'started' with retries
  let statusData: any;
  let retries = 0;
  const maxRetries = 20;
  let isStarted = false;

  console.log(`Waiting for machine ${machine.id} to start...`);
  while (retries < maxRetries) {
    try {
      statusData = await getMachineStatus(machine.id, appName);
      console.log(
        `Attempt ${retries + 1}/${maxRetries}: Machine status: ${
          statusData?.state || "unknown"
        }`
      );
      if (statusData?.state === "started") {
        isStarted = true;
        break; // Exit loop if started
      }
      if (
        statusData?.state === "failed" ||
        statusData?.state === "stopped" ||
        statusData?.state === "destroyed"
      ) {
        throw new Error(
          `Machine ${machine.id} entered unexpected state: ${statusData.state}`
        );
      }
    } catch (error: any) {
      console.warn(
        `Attempt ${retries + 1}: Error checking status for machine ${
          machine.id
        }: ${error.message}`
      );
    }

    retries++;
    if (retries < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1-second delay
    }
  }

  // 3. Check status after retries and throw error if not started
  if (!isStarted) {
    throw new Error(
      `Machine ${
        machine.id
      } did not reach 'started' state after ${maxRetries} attempts. Last known status: ${
        statusData?.state || "unknown"
      }`
    );
  }

  console.log(`Machine ${machine.id} has started.`);

  try {
    console.log(`Setting init command for machine ${machine.id}...`);
    const initResult = await execCommandOnFlyMachine(machine.id, publicKey, appName);
    console.log("Set init command result:", initResult);
  } catch (error: any) {
    console.error(
      `Error setting init command for machine ${machine.id}:`,
      error.message
    );
    throw new Error(
      `Machine ${machine.id} started, but failed to set init command.`
    );
  }

  return machine;
}
