export function getValidatorStatusInfo(status: string): {
  label: string;
  color: string;
} {
  switch (status) {
    case "BOND_STATUS_BONDED":
      return { label: "Bonded", color: "teal" };
    case "BOND_STATUS_UNBONDING":
      return { label: "Unbonding", color: "amber" };
    case "BOND_STATUS_UNBONDED":
      return { label: "Unbonded", color: "slate" };
    default:
      return { label: status, color: "slate" };
  }
}

export function getHealthStatusInfo(isHealthy: boolean): {
  label: string;
  color: string;
} {
  return isHealthy
    ? { label: "Healthy", color: "teal" }
    : { label: "Unhealthy", color: "rose" };
}

export function getEndpointTypeLabel(type: string): string {
  switch (type) {
    case "rpc":
      return "RPC";
    case "rest":
      return "REST";
    case "evm-rpc":
      return "EVM-RPC";
    case "grpc":
      return "gRPC";
    default:
      return type.toUpperCase();
  }
}
