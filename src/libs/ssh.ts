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
