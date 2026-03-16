import { createSchema } from "graphql-yoga";
import { validatorResolvers } from "./resolvers/validators";
import { endpointResolvers } from "./resolvers/endpoints";
import { statsResolvers } from "./resolvers/stats";
import { anomalyResolvers } from "./resolvers/anomalies";
import { sloResolvers } from "./resolvers/slos";
import { incidentResolvers } from "./resolvers/incidents";
import { webhookResolvers } from "./resolvers/webhooks";
import { governanceResolvers } from "./resolvers/governance";

export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Query {
      validators(status: String, limit: Int, offset: Int): ValidatorConnection!
      validator(id: ID!): Validator
      endpoints(type: String): [Endpoint!]!
      bestEndpoint(type: String!): Endpoint
      networkStats: NetworkStats
      anomalies(
        resolved: Boolean
        limit: Int
        offset: Int
      ): AnomalyConnection!
      slos: [Slo!]!
      incidents(
        status: String
        limit: Int
        offset: Int
      ): IncidentConnection!
      webhooks: [Webhook!]!
      governanceProposals(status: String, limit: Int): [GovernanceProposal!]!
    }

    type Mutation {
      createWebhook(input: CreateWebhookInput!): Webhook!
      deleteWebhook(id: ID!): Boolean!
      createSlo(input: CreateSloInput!): Slo!
      deleteSlo(id: ID!): Boolean!
    }

    type Validator {
      id: ID!
      moniker: String!
      status: String!
      tokens: String!
      commission: Float!
      jailed: Boolean!
      uptime: Float!
      votingPower: String!
      missedBlocks: Int!
      firstSeen: String!
      lastUpdated: String!
    }

    type ValidatorConnection {
      items: [Validator!]!
      total: Int!
    }

    type Endpoint {
      id: ID!
      url: String!
      type: String!
      provider: String
      isOfficial: Boolean!
      isActive: Boolean!
      score: Float
    }

    type NetworkStats {
      totalValidators: Int!
      activeValidators: Int!
      totalStaked: String!
      blockHeight: String!
      avgBlockTime: Float
      timestamp: String!
    }

    type Anomaly {
      id: ID!
      type: String!
      severity: String!
      entityType: String!
      entityId: String
      title: String!
      description: String!
      resolved: Boolean!
      detectedAt: String!
      resolvedAt: String
    }

    type AnomalyConnection {
      items: [Anomaly!]!
      total: Int!
    }

    type Slo {
      id: ID!
      name: String!
      indicator: String!
      entityType: String!
      entityId: String!
      target: Float!
      windowDays: Int!
      isActive: Boolean!
      isBreaching: Boolean!
      currentValue: Float
      budgetConsumed: Float
    }

    type Incident {
      id: ID!
      entityType: String!
      entityId: String!
      status: String!
      severity: String!
      title: String!
      description: String!
      detectedAt: String!
      acknowledgedAt: String
      resolvedAt: String
    }

    type IncidentConnection {
      items: [Incident!]!
      total: Int!
    }

    type Webhook {
      id: ID!
      name: String!
      url: String!
      events: [String!]!
      isActive: Boolean!
      createdAt: String!
    }

    type GovernanceProposal {
      id: ID!
      title: String!
      status: String!
      proposer: String
      submitTime: String
      votingStartTime: String
      votingEndTime: String
    }

    input CreateWebhookInput {
      name: String!
      url: String!
      events: [String!]!
    }

    input CreateSloInput {
      name: String!
      indicator: String!
      entityType: String!
      entityId: String!
      target: Float!
      windowDays: Int!
    }
  `,
  resolvers: {
    Query: {
      ...validatorResolvers.Query,
      ...endpointResolvers.Query,
      ...statsResolvers.Query,
      ...anomalyResolvers.Query,
      ...sloResolvers.Query,
      ...incidentResolvers.Query,
      ...webhookResolvers.Query,
      ...governanceResolvers.Query,
    },
    Mutation: {
      ...webhookResolvers.Mutation,
      ...sloResolvers.Mutation,
    },
  },
});
