import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { DeterministicVerificationSummary, ErrorAlert } from "./components";
import { ApiRequestError } from "./services/api";
import { Details } from "./pages";
import type { AnalysisResponse } from "./types/api";

describe("ErrorAlert", () => {
  it("shows a friendly quota message and readable profile stage", () => {
    const html = renderToStaticMarkup(<ErrorAlert error={new ApiRequestError(
      "http",
      "AI analysis is temporarily unavailable because the model quota has been reached. Please try again later.",
      503,
      "llm_quota_exceeded",
      "profile_analysis",
    )} />);

    expect(html).toContain("AI service temporarily unavailable");
    expect(html).toContain("during CV profile extraction");
    expect(html).not.toContain("profile_analysis");
  });

  it("shows a friendly message for an invalid model response", () => {
    const html = renderToStaticMarkup(<ErrorAlert error={new ApiRequestError(
      "http",
      "AI analysis could not process the model response. Please try again later.",
      502,
      "llm_invalid_response",
    )} />);

    expect(html).toContain("AI response could not be processed");
    expect(html).toContain("Please try again later.");
  });
});

describe("Deterministic verification presentation", () => {
  it("displays deterministic checks only when semantic review is unavailable", () => {
    const result: AnalysisResponse = {
      user_id: 7,
      source: "existing_profile",
      final_status: "VERIFICATION_FAILED",
      verified: false,
      revision_count: 1,
      target_career_id: "C01",
      document: null,
      redaction: null,
      profile_extraction: null,
      recommendations: [],
      skill_gap: null,
      roadmap: null,
      verification: {
        status: "REVISE",
        checks: [
          {
            check: "recommendation.canonical_careers",
            status: "PASS",
            reason: "Canonical career set is valid.",
            source_ids: ["C01"],
          },
          {
            check: "semantic.occupational_claims",
            status: "REVISE",
            reason: "Provider unavailable; HTTP 503.",
            source_ids: [],
          },
        ],
        unsupported_claims: [],
        required_revision: ["Retry semantic review."],
        llm_error: "Provider failure details omitted.",
        semantic_review_retry_count: 2,
        semantic_review_failure_type: "provider_unavailable",
      },
    };
    const html = renderToStaticMarkup(<Details r={result} />);

    expect(html).toContain("Deterministic Verification Results: PASS");
    expect(html).toContain("recommendation.canonical_careers");
    expect(html).toContain("Canonical career set is valid.");
    expect(html).toContain("C01");
    expect(html).toContain("Agent revisions: 1");
    expect(html).toContain("complete verification process");
    expect(html).not.toContain("semantic.occupational_claims");
    expect(html).not.toContain("Provider unavailable");
    expect(html).not.toContain("HTTP 503");
    expect(html).not.toContain("Retry semantic review");
    expect(html).not.toContain("Provider failure details");
    expect(html).not.toContain("provider_unavailable");
    expect(html).not.toContain("semantic_review_retry_count");
    expect(html).not.toContain("semantic_review_failure_type");
    expect(html).not.toContain("VERIFIED");
    expect(html).not.toContain(">Verified<");
    expect(html).not.toContain("Revisions used: 2");
  });

  it("does not display a semantic failure when deriving deterministic status", () => {
    const html = renderToStaticMarkup(
      <DeterministicVerificationSummary
        checks={[
          {
            check: "recommendation.canonical_careers",
            status: "FAIL",
            reason: "Canonical career set is invalid.",
            source_ids: [],
          },
          {
            check: "semantic.occupational_claims",
            status: "PASS",
            reason: "Semantic finding is not part of this presentation.",
            source_ids: [],
          },
        ]}
        revisions={2}
      />,
    );
    expect(html).toContain("Deterministic checks: FAIL");
    expect(html).toContain("Agent revisions: 2");
    expect(html).not.toContain("Semantic finding");
    expect(html).not.toContain("VERIFIED");
  });
});
