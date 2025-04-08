/* eslint-disable @typescript-eslint/no-explicit-any */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export function generateSSHKeys(workspaceId: string): {
  privateKey: string;
  publicKey: string;
} {
  const keysDir = path.join("/tmp", "workspace-keys");
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }
  const keyPath = path.join(keysDir, workspaceId);
  execSync(`ssh-keygen -t ed25519 -f ${keyPath} -N "" -q`, { timeout: 5000 });
  const privateKey = fs.readFileSync(keyPath, "utf8");
  const publicKey = fs.readFileSync(`${keyPath}.pub`, "utf8");
  return { privateKey, publicKey };
}

export async function createMachine(workspaceId: string): Promise<any> {
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
                // handlers: ["proxy_proto"],
                // force_https: false,
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
    "https://api.machines.dev/v1/apps/vibecoder/machines",
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

async function execCommandOnFlyMachine(machineId: string, publicKey: string) {
  const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
  const cmd = [
    "/bin/sh",
    "-c",
    `mkdir -p /home/vibecoder/.ssh && printf '%s' "${publicKey}" > /home/vibecoder/.ssh/authorized_keys && chmod 700 /home/vibecoder/.ssh && chmod 600 /home/vibecoder/.ssh/authorized_keys && chown -R vibecoder:vibecoder /home/vibecoder/.ssh && /usr/sbin/sshd -D`
  ];

  const response = await fetch(
    `https://api.machines.dev/v1/apps/vibecoder/machines/${machineId}/exec`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        command: cmd, // 👈 Correctly passing as an array
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

export async function getMachineStatus(machineId: string): Promise<any> {
  const response = await fetch(
    `https://api.machines.dev/v1/apps/vibecoder/machines/${machineId}`,
    {
      headers: { Authorization: `Bearer ${process.env.FLY_API_TOKEN}` },
    }
  );
  if (!response.ok) {
    // Handle 404 specifically as potentially recoverable (machine just created)
    if (response.status === 404) {
      console.warn(`Machine ${machineId} not found yet (status 404).`);
      // Return a synthetic status or throw a specific error if needed
      return { state: "not_found" }; // Example: return a specific state
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
  publicKey: string
): Promise<any> {
  // 1. Create machine
  const machine = await createMachine(workspaceId);
  console.log(`Machine created with ID: ${machine.id}`);

  // 2. Wait for machine to be 'started' with retries
  let statusData: any;
  let retries = 0;
  const maxRetries = 20;
  let isStarted = false;

  console.log(`Waiting for machine ${machine.id} to start...`);
  while (retries < maxRetries) {
    try {
      statusData = await getMachineStatus(machine.id);
      console.log(
        `Attempt ${retries + 1}/${maxRetries}: Machine status: ${
          statusData?.state || "unknown"
        }`
      );
      if (statusData?.state === "started") {
        isStarted = true;
        break; // Exit loop if started
      }
      // Handle specific non-started states if needed, e.g., 'creating', 'starting'
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
      // Don't immediately fail on error, allow retries unless it's a definitive failure state
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
    const initResult = await execCommandOnFlyMachine(machine.id, publicKey);
    console.log("Set init command result:", initResult);
  } catch (error: any) {
    console.error(
      `Error setting init command for machine ${machine.id}:`,
      error.message
    );
    // Consider if failure to set init cmd should stop the whole process
    // For now, throwing an error to indicate incomplete setup
    throw new Error(
      `Machine ${machine.id} started, but failed to set init command.`
    );
  }

  // 5. Return the machine object (status details handled above)
  return machine;
}

export async function allocateIPAddress(): Promise<string> {
  const allocateIpMutation = `
    mutation AllocateIPAddress($input: AllocateIPAddressInput!) {
      allocateIpAddress(input: $input) {
        ipAddress {
          id
          address
          type
        }
      }
    }
  `;
  const graphqlRequest = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: allocateIpMutation,
      variables: { input: { appId: "vibecoder", type: "v4" } },
    }),
  };
  const graphqlResponse = await fetch(
    "https://api.fly.io/graphql",
    graphqlRequest
  );
  if (!graphqlResponse.ok) {
    const errorData = await graphqlResponse.text();
    throw new Error(
      `GraphQL API error allocating IP: ${graphqlResponse.status} - ${errorData}`
    );
  }
  const graphqlData = await graphqlResponse.json();
  if (graphqlData.errors) {
    throw new Error(
      `GraphQL error allocating IP: ${JSON.stringify(graphqlData.errors)}`
    );
  }
  const ipv4Address = graphqlData.data?.allocateIpAddress?.ipAddress?.address;
  if (!ipv4Address)
    throw new Error("Failed to allocate IPv4 address (no address returned)");
  return ipv4Address;
}

export function storeKeys(
  workspaceId: string,
  privateKey: string,
  publicKey: string
): void {
  const keyStoragePath = path.join(process.cwd(), "workspace-keys");
  if (!fs.existsSync(keyStoragePath)) {
    fs.mkdirSync(keyStoragePath, { recursive: true });
  }
  // Ensure keys have appropriate permissions (more restrictive)
  try {
    fs.writeFileSync(
      path.join(keyStoragePath, `${workspaceId}.private`),
      privateKey,
      { mode: 0o600 }
    ); // Read/write for owner only
    fs.writeFileSync(
      path.join(keyStoragePath, `${workspaceId}.pub`),
      publicKey,
      { mode: 0o644 }
    ); // Read for owner, read for group/others
    console.log(
      `Stored keys for workspace ${workspaceId} in ${keyStoragePath}`
    );
  } catch (error: any) {
    console.error(
      `Failed to store keys for workspace ${workspaceId}: ${error.message}`
    );
    throw new Error(`Failed to store SSH keys for workspace ${workspaceId}.`); // Re-throw for clarity
  }
}

// Ensure environment variables are checked somewhere, e.g., at the start of the application
if (!process.env.FLY_API_TOKEN) {
  console.error("FLY_API_TOKEN environment variable is not set.");
  // Optional: process.exit(1); // Exit if the token is essential for the module to function
  throw new Error("FLY_API_TOKEN environment variable is required.");
}
