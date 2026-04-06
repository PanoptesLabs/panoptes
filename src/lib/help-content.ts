/**
 * Centralized help content dictionary for contextual tooltips.
 * Keys are organized by category and used by the HelpTooltip component.
 */

export const helpContent = {
  // ── Policy Condition Fields ──
  policies: {
    conditionFields: {
      "anomaly.type": "The type of detected anomaly (e.g. jailing, commission spike). Matches against the anomaly classification.",
      "anomaly.severity": "Severity level of the anomaly: critical, high, medium, or low.",
      "anomaly.entityType": "The entity this anomaly relates to: validator, endpoint, or network.",
      "endpoint.score": "Health score of the endpoint (0–100). Higher is better.",
      "endpoint.uptime": "Uptime percentage of the endpoint over the evaluation window.",
      "endpoint.latency": "Average response latency of the endpoint in milliseconds.",
      "endpoint.isHealthy": "Whether the endpoint is currently passing health checks (true/false).",
      "validator.score": "Composite validator score (0–100) based on uptime, governance, and performance.",
      "validator.jailed": "Whether the validator is currently jailed for misbehavior (true/false).",
      "validator.missedBlocks": "Number of blocks the validator failed to sign in the current window.",
      "validator.commission": "The validator's current commission rate (0–1 decimal).",
      "slo.isBreaching": "Whether the SLO is currently below its target threshold (true/false).",
      "slo.budgetConsumed": "Percentage of the error budget consumed (0–100). 100 means fully exhausted.",
      "slo.currentValue": "The current measured value of the SLO indicator.",
    },
    operators: {
      eq: "Equal to — exact match comparison.",
      neq: "Not equal to — matches when values differ.",
      gt: "Greater than — matches when the field value exceeds the threshold.",
      gte: "Greater than or equal to.",
      lt: "Less than — matches when the field value is below the threshold.",
      lte: "Less than or equal to.",
      in: "In list — matches when the field value is one of the specified values (comma-separated).",
    },
    actionTypes: {
      log: "Record the policy match in the execution log without taking external action.",
      webhook: "Send an HTTP notification to the configured webhook endpoint.",
      routing_exclude: "Exclude the matched entity from load balancing / routing decisions.",
      annotate: "Add a system annotation to the anomaly for later review.",
      incident_create: "Automatically create a new incident when conditions are met.",
    },
    concepts: {
      dryRun: "Dry Run mode evaluates conditions and logs matches without executing actions. Use it to test policies safely before going live.",
      cooldown: "Minimum minutes between consecutive triggers for this policy. Prevents alert fatigue from repeated matches.",
      priority: "Execution order when multiple policies match. Lower numbers run first (1 = highest priority).",
    },
  },

  // ── Anomalies ──
  anomalies: {
    types: {
      jailing: "Validator was jailed for missing too many blocks or double-signing.",
      large_stake_change: "A significant change in delegation amount was detected (> threshold).",
      commission_spike: "Validator suddenly increased their commission rate beyond normal range.",
      endpoint_down: "An RPC/REST endpoint stopped responding to health checks.",
      block_stale: "No new blocks produced for longer than the expected interval.",
      mass_unbonding: "Multiple delegators began unbonding from the same validator simultaneously.",
    },
    severities: {
      critical: "Immediate attention required. Service impact is occurring or imminent.",
      high: "Significant issue that could escalate. Should be addressed soon.",
      medium: "Moderate issue worth monitoring. May not require immediate action.",
      low: "Minor observation. Informational only.",
    },
    entityTypes: {
      validator: "A blockchain validator node responsible for signing and proposing blocks.",
      endpoint: "An RPC or REST API endpoint used to interact with the chain.",
      network: "Network-wide event affecting the overall chain health.",
    },
  },

  // ── SLOs ──
  slos: {
    indicators: {
      uptime: "Percentage of time the entity was available and responding normally.",
      latency: "Average response time. Lower is better.",
      error_rate: "Percentage of requests resulting in errors.",
      block_production: "Rate at which the validator successfully proposes/signs blocks.",
    },
    concepts: {
      target: "The minimum acceptable value for this SLO. Falling below this marks the SLO as breaching.",
      windowDays: "Rolling evaluation window in days. The SLO is measured over this period.",
      errorBudget: "Allowable amount of downtime/errors before breaching the SLO. Consumed budget = 100% means no room for further degradation.",
      breaching: "The SLO's current value is below the target. Action may be needed to restore compliance.",
    },
  },

  // ── Webhooks ──
  webhooks: {
    concepts: {
      secret: "HMAC signing secret used to verify webhook payloads. Include this in your signature validation to ensure requests are authentic.",
      httpsRequired: "Webhook URLs must use HTTPS to protect payload data in transit.",
      deliveryLog: "History of all webhook delivery attempts with status codes and retry counts.",
      eventSelection: "Select which events should trigger this webhook notification.",
    },
  },

  // ── Forecasts ──
  forecasts: {
    metrics: {
      latency: "Predicted future latency based on current trends.",
      jail_risk: "Probability of the validator being jailed based on missed-block patterns.",
      downtime: "Predicted downtime duration or occurrence probability.",
      unbonding: "Expected delegation outflow from the validator.",
      breach_risk: "Likelihood that an SLO will breach within the forecast horizon.",
    },
    concepts: {
      confidence: "How confident the model is in this prediction (0–100%). Higher means more reliable.",
      timeHorizon: "How far into the future this forecast looks (e.g. 24h, 7d).",
      prediction: "The forecast outcome: normal (no action), warning (watch closely), or critical (intervene now).",
    },
  },

  // ── Validators ──
  validators: {
    fields: {
      commission: "Percentage of delegator rewards the validator keeps. Lower commission means more rewards for delegators.",
      votingPower: "Proportional influence in consensus. Based on total staked tokens.",
      score: "Composite health score (0–100) combining uptime, governance participation, and performance metrics.",
      jailed: "A jailed validator cannot participate in consensus or earn rewards until unjailed.",
      missedBlocks: "Blocks the validator failed to sign. High numbers may lead to jailing.",
    },
    statuses: {
      bonded: "Actively participating in consensus and earning rewards.",
      unbonding: "Transitioning out of the active set. Tokens are locked for the unbonding period.",
      unbonded: "Not participating in consensus. No rewards earned.",
    },
  },

  // ── Leaderboard ──
  leaderboard: {
    categories: {
      overall: "Combined score across all metrics: uptime, commission, governance, and growth.",
      uptime: "Ranked by availability — validators with the highest uptime percentage.",
      commission: "Ranked by commission rate — lower commission ranks higher (better for delegators).",
      governance: "Ranked by governance participation — percentage of proposals voted on.",
      rising: "Validators showing the most improvement in score over recent periods.",
      stake_magnet: "Validators attracting the most new delegations recently.",
      compute: "Ranked by compute jobs processed — validators handling the most AI/ML workloads.",
    },
  },

  // ── Network ──
  network: {
    fields: {
      bondedRatio: "Percentage of total token supply currently staked. Higher ratio = more network security.",
      blockHeight: "The latest confirmed block number on the chain.",
      avgBlockTime: "Average time between consecutive blocks. Indicates chain speed.",
      txSuccessRate: "Percentage of transactions that completed successfully across the network lifetime.",
      feeRevenue: "Total transaction fees collected by the network across all blocks.",
      gasDistribution: "Distribution of gas usage across transactions. Shows the most common gas consumption ranges.",
      messageTypes: "Breakdown of transaction types on the network. Shows which operations are most common.",
      blockTime: "Time between consecutive blocks. Spikes may indicate network congestion or validator issues.",
      dailyTxVolume: "Number of transactions processed each day over the last 30 days.",
      dailyRewards: "Total validator rewards and commissions distributed each day across the network.",
    },
  },

  // ── Endpoints ──
  endpoints: {
    fields: {
      latency: "Average response time for the endpoint. Measured across recent health checks.",
      uptime: "Percentage of successful health checks over the monitoring window.",
      healthy: "Endpoint is responding correctly and within latency thresholds.",
      unhealthy: "Endpoint is failing health checks or exceeding latency thresholds.",
    },
  },

  // ── Delegations ──
  delegations: {
    fields: {
      churnRate: "Rate of delegator turnover for a validator. High churn may signal instability or dissatisfaction.",
    },
    types: {
      whale: "A delegation event involving an unusually large token amount that could affect validator economics.",
      delegate: "Tokens staked to a validator, increasing their voting power.",
      undelegate: "Tokens withdrawn from a validator. Subject to the unbonding period.",
      redelegate: "Tokens moved from one validator to another without unbonding delay.",
    },
  },

  // ── Incidents ──
  incidents: {
    statuses: {
      open: "Incident detected and not yet triaged. Requires attention.",
      acknowledged: "Team is aware and investigating the incident.",
      resolved: "Incident has been addressed and the issue is no longer active.",
    },
    concepts: {
      severity: "Impact level of the incident: critical, high, medium, or low.",
      entityType: "The type of entity affected: validator, endpoint, or network.",
    },
  },

  // ── Compute ──
  compute: {
    fields: {
      job_id: "Unique identifier for the compute job.",
      status: "Current state of the job: PENDING (queued), COMPLETED (success), or FAILED (error).",
      execution_image: "The AI/ML model container image used to process this job.",
      fee_amount: "Fee paid for processing this compute job.",
      target_validator: "The validator responsible for executing this compute job.",
    },
    statuses: {
      COMPLETED: "Job was processed successfully and results are available.",
      PENDING: "Job is queued and waiting to be processed by the target validator.",
      FAILED: "Job processing failed. The validator was unable to complete the computation.",
    },
  },

  // ── API Keys ──
  apiKeys: {
    free: "Free tier: limited rate (100 req/min) and basic endpoints only.",
    pro: "Pro tier: higher rate limits (1000 req/min) and access to all endpoints including forecasts and streaming.",
    deactivate: "Permanently revokes the key. Any applications using it will lose access immediately.",
  },
} as const;
