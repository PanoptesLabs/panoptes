import { createYoga } from "graphql-yoga";
import { NextRequest, NextResponse } from "next/server";
import { schema } from "@/lib/graphql/schema";
import { createContext } from "@/lib/graphql/context";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/api-helpers";

// Simple depth calculator
function getQueryDepth(query: string): number {
  let depth = 0;
  let maxDepth = 0;
  for (const char of query) {
    if (char === "{") { depth++; maxDepth = Math.max(maxDepth, depth); }
    if (char === "}") { depth--; }
  }
  return maxDepth;
}

const MAX_QUERY_DEPTH = 7;

const yoga = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  context: async ({ request }) => createContext(request as NextRequest),
  maskedErrors: process.env.NODE_ENV === "production",
  graphiql: process.env.NODE_ENV !== "production",
  landingPage: false,
});

async function handler(request: NextRequest) {
  // Rate limiting
  const ip = getClientIp(request);
  const rateLimitResult = checkRateLimit(ip);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { errors: [{ message: "Rate limit exceeded" }] },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // Depth limiting for POST requests
  if (request.method === "POST") {
    try {
      const cloned = request.clone();
      const body = await cloned.json();
      if (body.query && getQueryDepth(body.query) > MAX_QUERY_DEPTH) {
        return NextResponse.json(
          { errors: [{ message: `Query depth exceeds maximum of ${MAX_QUERY_DEPTH}` }] },
          { status: 400 }
        );
      }
    } catch {
      // Parse error, let yoga handle it
    }
  }

  // Introspection blocking in production
  if (process.env.NODE_ENV === "production" && request.method === "POST") {
    try {
      const cloned = request.clone();
      const body = await cloned.json();
      if (body.query && (body.query.includes("__schema") || body.query.includes("__type"))) {
        return NextResponse.json(
          { errors: [{ message: "Introspection is disabled" }] },
          { status: 400 }
        );
      }
    } catch {
      // Parse error, let yoga handle it
    }
  }

  const response = await yoga.handleRequest(request, {});
  return new NextResponse(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

export { handler as GET, handler as POST };
