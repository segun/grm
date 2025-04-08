/* eslint-disable @typescript-eslint/no-explicit-any */

import { validateApiToken } from "../utils";

export async function getOrganizations(): Promise<any[]> {
  validateApiToken();
  
  const getOrgsQuery = `
    query {
      organizations {
        nodes {
          id
          slug
          name
        }
      }
    }
  `;
  
  const response = await fetch(
    "https://api.fly.io/graphql",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: getOrgsQuery
      }),
    }
  );
  
  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(
      `GraphQL API error fetching organizations: ${response.status} - ${errorData}`
    );
  }
  
  const data = await response.json();
  if (data.errors) {
    throw new Error(
      `GraphQL error fetching organizations: ${JSON.stringify(data.errors)}`
    );
  }
  
  return data.data?.organizations?.nodes || [];
}
