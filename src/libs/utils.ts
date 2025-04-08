export function validateApiToken(): void {
  if (!process.env.FLY_API_TOKEN) {
    console.error("FLY_API_TOKEN environment variable is not set.");
    throw new Error("FLY_API_TOKEN environment variable is required.");
  }
}
