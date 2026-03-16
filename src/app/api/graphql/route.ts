import { createYoga } from "graphql-yoga";
import { NextRequest, NextResponse } from "next/server";
import {
  parse,
  Kind,
  type DocumentNode,
  type SelectionNode,
  type FragmentDefinitionNode,
  validate,
  type ValidationRule,
  GraphQLError,
} from "graphql";
import { schema } from "@/lib/graphql/schema";
import { createContext } from "@/lib/graphql/context";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/api-helpers";

const MAX_QUERY_DEPTH = 7;
const MAX_QUERY_LENGTH = 10_000;

// Build fragment definition map from document
function buildFragmentMap(doc: DocumentNode): Map<string, FragmentDefinitionNode> {
  const map = new Map<string, FragmentDefinitionNode>();
  for (const def of doc.definitions) {
    if (def.kind === Kind.FRAGMENT_DEFINITION) {
      map.set(def.name.value, def);
    }
  }
  return map;
}

// AST-based depth calculation with fragment resolution and cycle detection
function getQueryDepthFromAST(doc: DocumentNode): number {
  const fragmentMap = buildFragmentMap(doc);
  let maxDepth = 0;

  function measureDepth(
    node: SelectionNode,
    depth: number,
    visited: Set<string>,
  ) {
    if (node.kind === Kind.FIELD) {
      const fieldDepth = depth + 1;
      if (fieldDepth > maxDepth) maxDepth = fieldDepth;
      if (node.selectionSet) {
        for (const sel of node.selectionSet.selections) {
          measureDepth(sel, fieldDepth, visited);
        }
      }
    } else if (node.kind === Kind.INLINE_FRAGMENT) {
      if (node.selectionSet) {
        for (const sel of node.selectionSet.selections) {
          measureDepth(sel, depth, visited);
        }
      }
    } else if (node.kind === Kind.FRAGMENT_SPREAD) {
      const fragName = node.name.value;
      // Cycle detection - skip already visited fragments
      if (visited.has(fragName)) return;
      const fragDef = fragmentMap.get(fragName);
      if (fragDef?.selectionSet) {
        const newVisited = new Set(visited);
        newVisited.add(fragName);
        for (const sel of fragDef.selectionSet.selections) {
          measureDepth(sel, depth, newVisited);
        }
      }
    }
  }

  for (const def of doc.definitions) {
    if (def.kind === Kind.OPERATION_DEFINITION && def.selectionSet) {
      for (const sel of def.selectionSet.selections) {
        measureDepth(sel, 0, new Set());
      }
    }
  }

  return maxDepth;
}

// Block __schema and __type introspection in production.
// __typename is part of the GraphQL spec and must remain accessible.
const BLOCKED_INTROSPECTION = new Set(["__schema", "__type"]);

const NoIntrospectionRule: ValidationRule = (context) => ({
  Field(node) {
    if (BLOCKED_INTROSPECTION.has(node.name.value)) {
      context.reportError(
        new GraphQLError("Introspection is disabled", { nodes: [node] }),
      );
    }
  },
});

const yoga = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  context: async ({ request }) => createContext(request as NextRequest),
  maskedErrors: process.env.NODE_ENV === "production",
  graphiql: process.env.NODE_ENV !== "production",
  landingPage: false,
});

// Extract query string from either POST body or GET search params
async function extractQuery(request: NextRequest): Promise<string | null> {
  if (request.method === "POST") {
    try {
      const cloned = request.clone();
      const body = await cloned.json();
      if (body.query && typeof body.query === "string") {
        return body.query;
      }
    } catch {
      // JSON parse error
    }
    return null;
  }

  // GET request: query is in search params
  const queryParam = request.nextUrl.searchParams.get("query");
  return queryParam;
}

async function handler(request: NextRequest) {
  // Rate limiting
  const ip = getClientIp(request);
  const rateLimitResult = checkRateLimit(ip);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { errors: [{ message: "Rate limit exceeded" }] },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // Extract and validate query from both POST and GET
  const query = await extractQuery(request);
  if (query) {
    // Query size limit
    if (query.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        { errors: [{ message: "Query too large" }] },
        { status: 400 },
      );
    }

    try {
      const doc = parse(query);

      // AST-based depth check (fragment-aware with cycle detection)
      if (getQueryDepthFromAST(doc) > MAX_QUERY_DEPTH) {
        return NextResponse.json(
          { errors: [{ message: "Query depth exceeds maximum allowed" }] },
          { status: 400 },
        );
      }

      // AST-based introspection blocking in production
      if (process.env.NODE_ENV === "production") {
        const errors = validate(schema, doc, [NoIntrospectionRule]);
        if (errors.length > 0) {
          return NextResponse.json(
            { errors: [{ message: "Introspection is disabled" }] },
            { status: 400 },
          );
        }
      }
    } catch {
      // GraphQL parse error - reject instead of passing through
      return NextResponse.json(
        { errors: [{ message: "Invalid GraphQL query" }] },
        { status: 400 },
      );
    }
  }

  const response = await yoga.handleRequest(request, {});
  return new NextResponse(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

export { handler as GET, handler as POST };
