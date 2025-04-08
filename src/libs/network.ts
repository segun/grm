/* eslint-disable @typescript-eslint/no-explicit-any */

import { validateApiToken } from "./utils";

export async function allocateIPAddress(appName: string): Promise<string> {
  validateApiToken();
  
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
      variables: { input: { appId: appName, type: "v4" } },
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
