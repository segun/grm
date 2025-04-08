/* eslint-disable @typescript-eslint/no-explicit-any */
// Replace the import that can't be found
import { validateApiToken } from "../utils";

export async function createApplication(appName: string, organizationId: string): Promise<any> {
  validateApiToken();
  
  // First check if the application already exists
  const appExists = await checkApplicationExists(appName);
  
  if (appExists) {
    console.log(`Application ${appName} already exists, retrieving details...`);
    return await getExistingApplication(appName);
  }
  
  // If app doesn't exist, create it
  const createAppMutation = `
    mutation CreateApp($input: CreateAppInput!) {
      createApp(input: $input) {
        app {
          id
          name
          organization {
            id
            slug
          }
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
      query: createAppMutation,
      variables: { 
        input: { 
          name: appName,
          organizationId: organizationId
        } 
      },
    }),
  };
  
  const graphqlResponse = await fetch(
    "https://api.fly.io/graphql",
    graphqlRequest
  );
  
  if (!graphqlResponse.ok) {
    const errorData = await graphqlResponse.text();
    throw new Error(
      `GraphQL API error creating application: ${graphqlResponse.status} - ${errorData}`
    );
  }
  
  const graphqlData = await graphqlResponse.json();
  if (graphqlData.errors) {
    // If the error is that the name is already taken, get the existing app
    if (graphqlData.errors.some((e: any) => e.message?.includes("Name has already been taken"))) {
      console.log(`Application ${appName} already exists (detected from error), retrieving details...`);
      return await getExistingApplication(appName);
    }
    
    throw new Error(
      `GraphQL error creating application: ${JSON.stringify(graphqlData.errors)}`
    );
  }
  
  const app = graphqlData.data?.createApp?.app;
  
  // Create an initial release to ensure the app can be used with fly console
  console.log(`Creating initial release for application ${appName}...`);
  try {
    await createInitialRelease(appName);
    console.log(`Initial release created successfully for ${appName}`);
  } catch (error: any) {
    console.warn(`Warning: Could not create initial release: ${error.message}`);
    console.warn(`You may not be able to use 'fly console' until a release is created.`);
  }
  
  return app;
}

/**
 * Creates an initial minimal release for an application to ensure fly console works
 */
async function createInitialRelease(appName: string): Promise<any> {
  const createReleaseMutation = `
    mutation DeployApp($input: CreateReleaseInput!) {
      createRelease(input: $input) {
        app {
          id
          name
        }
        release {
          id
          version
          status
        }
      }
    }
  `;
  
  // Use an SSH-enabled image for the initial release to ensure console access
  const graphqlRequest = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: createReleaseMutation,
      variables: { 
        input: { 
          appId: appName,
          image: "aardvocate/ubuntu-ssh-nodejs:latest",
          platformVersion: "machines",
          definition: {
            processes: {
              app: "sleep infinity"
            }
          },
          strategy: "IMMEDIATE"
        } 
      },
    }),
  };
  
  const graphqlResponse = await fetch(
    "https://api.fly.io/graphql",
    graphqlRequest
  );
  
  if (!graphqlResponse.ok) {
    const errorData = await graphqlResponse.text();
    throw new Error(
      `GraphQL API error creating release: ${graphqlResponse.status} - ${errorData}`
    );
  }
  
  const graphqlData = await graphqlResponse.json();
  if (graphqlData.errors) {
    throw new Error(
      `GraphQL error creating release: ${JSON.stringify(graphqlData.errors)}`
    );
  }
  
  return graphqlData.data?.createRelease?.release;
}

async function getExistingApplication(appName: string): Promise<any> {
  const getAppQuery = `
    query GetApp($name: String!) {
      app(name: $name) {
        id
        name
        organization {
          id
          slug
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
      query: getAppQuery,
      variables: { name: appName },
    }),
  };
  
  const graphqlResponse = await fetch(
    "https://api.fly.io/graphql",
    graphqlRequest
  );
  
  if (!graphqlResponse.ok) {
    const errorData = await graphqlResponse.text();
    throw new Error(
      `GraphQL API error retrieving application: ${graphqlResponse.status} - ${errorData}`
    );
  }
  
  const graphqlData = await graphqlResponse.json();
  if (graphqlData.errors) {
    throw new Error(
      `GraphQL error retrieving application: ${JSON.stringify(graphqlData.errors)}`
    );
  }
  
  return graphqlData.data?.app;
}

export async function checkApplicationExists(name: string): Promise<boolean> {
  validateApiToken();
  
  const response = await fetch(`https://api.fly.io/v1/apps/${name}`, {
    headers: {
      Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  return response.ok;
}
