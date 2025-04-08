/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from "next";
import { getOrganizations } from "../../libs/organization";

interface OrganizationsResponse {
  success: boolean;
  organizations?: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OrganizationsResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  if (!process.env.FLY_API_TOKEN) {
    return res.status(500).json({
      success: false,
      error: "FLY_API_TOKEN not configured"
    });
  }

  try {
    const organizations = await getOrganizations();
    return res.status(200).json({
      success: true,
      organizations
    });
  } catch (error: any) {
    console.error("Error fetching organizations:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch organizations: ${error.message || "Unknown error"}`
    });
  }
}
