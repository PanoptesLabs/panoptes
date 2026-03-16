import { createYoga } from "graphql-yoga";
import { schema } from "@/lib/graphql/schema";
import { createContext } from "@/lib/graphql/context";
import { NextRequest, NextResponse } from "next/server";

const yoga = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  context: async ({ request }) => createContext(request as NextRequest),
  fetchAPI: {
    Request: Request,
    Response: Response,
  },
});

async function handler(request: NextRequest) {
  const response = await yoga.handleRequest(request, {});
  return new NextResponse(response.body, {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
  });
}

export { handler as GET, handler as POST };
