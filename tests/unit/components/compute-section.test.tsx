import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseValidatorCompute = vi.fn();

vi.mock("@/hooks/use-compute", () => ({
  useValidatorCompute: (...args: unknown[]) => mockUseValidatorCompute(...args),
}));

vi.mock("@/lib/yaci", () => ({
  parseModelName: (img: string) => img.includes("gpt2") ? "GPT-2" : img.includes("mistral") ? "Mistral" : img,
}));

import { ComputeSection } from "@/components/dashboard/compute-section";

const STATS = { total_jobs: 500, completed_jobs: 400, success_rate: 80.0 };

const MODELS = ["GPT-2", "Mistral"];

const RECENT_JOBS = [
  {
    job_id: 1, status: "COMPLETED", creator: "rai1x", target_validator: "raivaloper1abc",
    execution_image: "republicai/gpt2-inference:latest", verification_image: null,
    fee_amount: "1000000", fee_denom: "arai", result_hash: "abc",
    result_fetch_endpoint: null, result_upload_endpoint: null,
    submit_tx_hash: "tx1", submit_height: 100, submit_time: "2026-04-01T00:00:00Z",
    result_tx_hash: "tx2", result_height: 101, result_time: "2026-04-01T00:01:00Z",
    created_at: "2026-04-01T00:00:00Z", updated_at: "2026-04-01T00:01:00Z",
  },
  {
    job_id: 2, status: "PENDING", creator: "rai1y", target_validator: "raivaloper1abc",
    execution_image: "republicai/mistral-inference:latest", verification_image: null,
    fee_amount: "2000000", fee_denom: "arai", result_hash: null,
    result_fetch_endpoint: null, result_upload_endpoint: null,
    submit_tx_hash: "tx3", submit_height: null, submit_time: null,
    result_tx_hash: null, result_height: null, result_time: null,
    created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z",
  },
];

describe("ComputeSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows skeleton loading state", () => {
    mockUseValidatorCompute.mockReturnValue({ data: undefined, isLoading: true });

    const { container } = render(<ComputeSection validatorId="raivaloper1abc" />);

    expect(screen.getByText("Compute Performance")).toBeDefined();
    // Should render 3 skeleton cards
    const skeletons = container.querySelectorAll("[class*='animate-pulse']");
    expect(skeletons.length).toBe(3);
  });

  it("shows empty state when no data at all", () => {
    mockUseValidatorCompute.mockReturnValue({
      data: { stats: null, models: [], recentJobs: [] },
      isLoading: false,
    });

    render(<ComputeSection validatorId="raivaloper1abc" />);

    expect(screen.getByText("No compute data available")).toBeDefined();
  });

  it("renders stat cards when stats are available", () => {
    mockUseValidatorCompute.mockReturnValue({
      data: { stats: STATS, models: [], recentJobs: [] },
      isLoading: false,
    });

    render(<ComputeSection validatorId="raivaloper1abc" />);

    expect(screen.getByText("Total Jobs")).toBeDefined();
    expect(screen.getByText("500")).toBeDefined();
    expect(screen.getByText("Completed")).toBeDefined();
    expect(screen.getByText("400")).toBeDefined();
    expect(screen.getByText("Success Rate")).toBeDefined();
    expect(screen.getByText("80.0%")).toBeDefined();
  });

  it("renders models and jobs even when stats are null (partial upstream failure)", () => {
    mockUseValidatorCompute.mockReturnValue({
      data: { stats: null, models: MODELS, recentJobs: RECENT_JOBS },
      isLoading: false,
    });

    render(<ComputeSection validatorId="raivaloper1abc" />);

    // Should NOT show empty state
    expect(screen.queryByText("No compute data available")).toBeNull();

    // Should show models
    expect(screen.getByText("Recently Used Models")).toBeDefined();
    expect(screen.getAllByText("GPT-2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Mistral").length).toBeGreaterThanOrEqual(1);

    // Should show recent jobs table
    expect(screen.getByText("Recent Jobs")).toBeDefined();
    expect(screen.getByText("COMPLETED")).toBeDefined();
    expect(screen.getByText("PENDING")).toBeDefined();

    // Stat cards should NOT be rendered
    expect(screen.queryByText("Total Jobs")).toBeNull();
  });

  it("renders all sections when full data is available", () => {
    mockUseValidatorCompute.mockReturnValue({
      data: { stats: STATS, models: MODELS, recentJobs: RECENT_JOBS },
      isLoading: false,
    });

    render(<ComputeSection validatorId="raivaloper1abc" />);

    expect(screen.getByText("Total Jobs")).toBeDefined();
    expect(screen.getByText("Recently Used Models")).toBeDefined();
    expect(screen.getByText("Recent Jobs")).toBeDefined();
  });

  it("does not render failed_jobs or pending_jobs stat cards", () => {
    mockUseValidatorCompute.mockReturnValue({
      data: { stats: STATS, models: [], recentJobs: [] },
      isLoading: false,
    });

    render(<ComputeSection validatorId="raivaloper1abc" />);

    expect(screen.queryByText("Failed")).toBeNull();
    expect(screen.queryByText("Pending")).toBeNull();
  });

  it("applies teal color to high success rate", () => {
    mockUseValidatorCompute.mockReturnValue({
      data: { stats: { ...STATS, success_rate: 95.0 }, models: [], recentJobs: [] },
      isLoading: false,
    });

    render(<ComputeSection validatorId="raivaloper1abc" />);

    const rateEl = screen.getByText("95.0%");
    expect(rateEl.className).toContain("text-teal");
  });

  it("applies amber color to medium success rate", () => {
    mockUseValidatorCompute.mockReturnValue({
      data: { stats: { ...STATS, success_rate: 60.0 }, models: [], recentJobs: [] },
      isLoading: false,
    });

    render(<ComputeSection validatorId="raivaloper1abc" />);

    const rateEl = screen.getByText("60.0%");
    expect(rateEl.className).toContain("text-amber");
  });

  it("applies rose color to low success rate", () => {
    mockUseValidatorCompute.mockReturnValue({
      data: { stats: { ...STATS, success_rate: 30.0 }, models: [], recentJobs: [] },
      isLoading: false,
    });

    render(<ComputeSection validatorId="raivaloper1abc" />);

    const rateEl = screen.getByText("30.0%");
    expect(rateEl.className).toContain("text-rose");
  });
});
