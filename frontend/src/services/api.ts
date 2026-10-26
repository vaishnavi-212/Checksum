import { ApiErrorPayload } from '../types/common';

export interface UploadResponse {
  job_id: string;
  status: string;
  path: '1' | '2a' | '2b' | string;
}

export interface AuditStatusResponse {
  job_id: string;
  status: 'queued' | 'running' | 'done' | 'failed' | string;
  path?: string;
  audit_mode?: string;
  fix_status?: string;
  fix_error?: string | null;
  progress?: string;
  warnings?: string[];
  error?: string;
}

export interface PerturbationResultItem {
  field_tested: string;
  n_candidates: number;
  avg_delta_pts: number;
  median_delta_pts: number;
  std_dev: number;
  min_delta_pts: number;
  max_delta_pts: number;
  wilcoxon_statistic: number;
  p_value: number;
  statistically_significant: boolean;
  severity: 'LOW' | 'MED' | 'HIGH' | string;
  per_candidate_deltas?: number[];
  n_scoring_errors?: number;
  note?: string | null;
  /** 'tested' | 'not_model_input' | 'single_group' | 'error' */
  status?: string;
  error?: string;
  reference_group?: string;
  from_group?: string;
  to_group?: string;
  comparison_label?: string;
  p_value_adjusted?: number;
  grouping?: string;
  comparisons?: PerturbationComparison[];
}

export interface PerturbationComparison {
  from_group: string;
  to_group: string;
  comparison_label: string;
  n_in_group: number;
  too_small: boolean;
  n_candidates: number;
  avg_delta_pts: number;
  median_delta_pts: number;
  p_value: number;
  p_value_adjusted: number;
  statistically_significant: boolean;
  severity: string;
}

export interface ShapSummaryItem {
  method?: string;
  skill_reliance_pct?: number;
  pedigree_reliance_pct?: number;
  feature_importances?: Record<string, number>;
  top_features?: any[];
  n_candidates_tested?: number;
  n_candidates_total?: number;
  n_candidates_skipped?: number;
  n_model_scoring_errors?: number;
  note?: string | null;
  [key: string]: any;
}

export interface ScoreItem {
  candidate_id: string;
  score: number | null;
  decision?: string;
  missing_fields?: string[];
  error?: string;
  input_features?: {
    screening_score?: number | string | null;
    college_tier?: number | string | null;
    is_metro?: number | string | boolean | null;
    experience_years?: number | string | null;
    career_gap_months?: number | string | null;
    [key: string]: any;
  };
  screening_score?: number | string | null;
  college_tier?: number | string | null;
  is_metro?: number | string | boolean | null;
  experience_years?: number | string | null;
  career_gap_months?: number | string | null;
  [key: string]: any;
}

export interface AvailabilityReportItem {
  present?: boolean;
  inferred?: boolean;
  missing?: boolean;
  coverage_pct?: number | string;
  status?: string;
  [key: string]: any;
}

export interface FourFifthsRuleResult {
  flag?: boolean;
  ratios?: Record<string, number>;
  flagged_groups?: Record<string, number>;
  below_four_fifths_not_significant?: Record<string, number>;
  insufficient_sample_groups?: string[];
  group_p_values?: Record<string, number>;
  p_value?: number | null;
  note?: string;
}

export interface DemographicParityResult {
  difference?: number;
  max_rate?: number;
  min_rate?: number;
  threshold?: number;
  flag?: boolean;
  p_value?: number;
  note?: string;
}

export interface MatchedPairResult {
  method?: string;
  flag?: boolean;
  p_value?: number;
  n_pairs?: number;
  reference_group?: string;
  comparison_group?: string;
  contingency_table?: number[][];
  common_odds_ratio?: number | null;
  comparisons?: MatchedPairComparison[];
  assumptions?: string;
  error?: string;
  note?: string;
  [key: string]: any;
}

export interface MatchedPairComparison {
  reference_group: string;
  comparison_group: string;
  p_value: number;
  p_value_raw: number;
  common_odds_ratio: number | null;
  n_pairs: number;
  flag: boolean;
  contingency_table: number[][];
}

export interface StatisticalResults {
  group_field?: string;
  outcome_field?: string;
  n_groups?: number;
  selection_rates?: Record<string, number>;
  four_fifths_rule?: FourFifthsRuleResult;
  demographic_parity?: DemographicParityResult;
  matched_pair?: MatchedPairResult;
  group_sizes?: Record<string, number>;
  min_group_size?: number;
  insufficient_sample_groups?: string[];
  grouping?: string;
  additional_group_audits?: Record<string, StatisticalResults>;
  fields_flagged?: string[];
  error?: string;
  [key: string]: any;
}

export interface MitigationMeta {
  n_total_candidates?: number;
  n_candidates_used?: number;
  n_scoring_errors?: number;
  groups_dropped?: string[];
  group_field?: string;
}

export interface GroupRate {
  rate: number;
  n: number;
}

export interface FixBeforeAfter {
  strategy_requested?: string;
  strategy_applied?: string | null;
  pedigree_reliance_before_pct?: number | null;
  pedigree_reliance_after_pct?: number | null;
  improved?: boolean;
  mitigation_meta?: MitigationMeta;
  before_summary?: ShapSummaryItem | null;
  after_summary?: ShapSummaryItem | null;
  group_field?: string;
  measurement_method?: string;
  shortlist_rates_before?: Record<string, GroupRate>;
  shortlist_rates_after?: Record<string, GroupRate>;
  four_fifths_ratio_before?: number | null;
  four_fifths_ratio_after?: number | null;
  selection_gap_improved?: boolean;
  note?: string;
}

export interface ResultsResponse {
  job_id: string;
  audit_mode?: 'perturbation' | 'statistical_only' | string;
  availability_report?: Record<string, AvailabilityReportItem>;
  scores?: ScoreItem[];
  perturbation_results?: PerturbationResultItem[];
  shap_summary?: ShapSummaryItem;
  statistical_results?: StatisticalResults;
  explainability_method?: string;
  warnings?: string[];
  fix_applied?: boolean;
  fix_before_after?: FixBeforeAfter | null;
}

export interface TriggerFixResponse {
  job_id: string;
  fix_status: string;
  strategy: string;
}

export interface HealthResponse {
  status: string;
  app?: string;
  [key: string]: any;
}

/**
 * GET /health - Engine health check
 */
export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE}/health`, {
    method: 'GET',
    headers: withAuth({
      'Accept': 'application/json',
    }),
  });

  return handleResponse<HealthResponse>(response);
}

export interface ExplanationResponse {
  job_id: string;
  explanation: string | null;
}

export interface PerturbCandidateRequest {
  field: string;
  new_value: any;
}

export interface PerturbCandidateResponse {
  candidate_id: string;
  field: string;
  original_value: any;
  new_value: any;
  original_score: number;
  perturbed_score: number;
  delta: number;
}

// Set VITE_API_BASE_URL in Vercel (Project → Settings → Environment Variables)
// to your Render URL. Local dev falls back to a backend on localhost:8000.
// There is deliberately no production fallback: a stale hard-coded URL is what
// silently broke every upload when the old backend went away.
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')
).replace(/\/+$/, '');

if (!API_BASE) {
  console.error('VITE_API_BASE_URL is not set; API calls will fail. Set it in your hosting environment.');
}

// Optional: only if the backend sets CHECKSUM_API_KEY. Anything in a VITE_
// variable ends up in the public JS bundle, so this is a speed bump against
// casual abuse, not real authentication.
const API_KEY: string | undefined = import.meta.env.VITE_API_KEY || undefined;

function withAuth(headers: Record<string, string> = {}): Record<string, string> {
  return API_KEY ? { ...headers, 'X-API-Key': API_KEY } : headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: ApiErrorPayload = {
      error_code: 'HTTP_ERROR',
      detail: `Server returned status ${response.status}`,
    };

    try {
      const json = await response.json();
      if (typeof json.detail === 'object' && json.detail !== null) {
        errorData = {
          error_code: json.detail.error_code || 'BAD_REQUEST',
          detail: json.detail.detail || JSON.stringify(json.detail),
          job_id: json.job_id,
        };
      } else if (typeof json.detail === 'string') {
        errorData = {
          error_code: json.error_code || 'BAD_REQUEST',
          detail: json.detail,
          job_id: json.job_id,
        };
      } else if (json.error_code) {
        errorData = {
          error_code: json.error_code,
          detail: json.detail || 'An error occurred during API processing',
          job_id: json.job_id,
        };
      }
    } catch {
      // Failed to parse JSON error, fallback to default HTTP status detail
    }

    throw errorData;
  }

  return response.json() as Promise<T>;
}

/**
 * Path 1: Upload candidates dataset CSV to run audit against Checksum's default Hiring Agent.
 * Route: POST /audit/upload
 */
export async function uploadCandidatesOnly(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/audit/upload`, {
    method: 'POST',
    headers: withAuth(),
    body: formData,
  });

  return handleResponse<UploadResponse>(response);
}

/**
 * Path 2a / 2b: Upload candidates dataset CSV with optional external model endpoint URL.
 * Path 2a: Candidates + decisions + external_model_endpoint
 * Path 2b: Decisions-only dataset (no external endpoint)
 * Route: POST /audit/upload-external
 */
export async function uploadCandidatesExternal(
  file: File,
  externalModelEndpoint?: string
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  if (externalModelEndpoint && externalModelEndpoint.trim().length > 0) {
    formData.append('external_model_endpoint', externalModelEndpoint.trim());
  }

  const response = await fetch(`${API_BASE}/audit/upload-external`, {
    method: 'POST',
    headers: withAuth(),
    body: formData,
  });

  return handleResponse<UploadResponse>(response);
}

/**
 * GET /audit/{job_id}/status - Fetch real-time job execution status
 */
export async function getJobStatus(jobId: string): Promise<AuditStatusResponse> {
  const response = await fetch(`${API_BASE}/audit/${jobId}/status`, {
    method: 'GET',
    headers: withAuth({
      'Accept': 'application/json',
    }),
  });

  return handleResponse<AuditStatusResponse>(response);
}

/**
 * GET /audit/{job_id}/results - Fetch complete Layer 1-3 audit results
 */
export async function getJobResults(jobId: string): Promise<ResultsResponse> {
  const response = await fetch(`${API_BASE}/audit/${jobId}/results`, {
    method: 'GET',
    headers: withAuth({
      'Accept': 'application/json',
    }),
  });

  return handleResponse<ResultsResponse>(response);
}

/**
 * GET /audit/{job_id}/explanation - Fetch human-readable LLM explanation narrative
 */
export async function getJobExplanation(jobId: string): Promise<ExplanationResponse> {
  const response = await fetch(`${API_BASE}/audit/${jobId}/explanation`, {
    method: 'GET',
    headers: withAuth({
      'Accept': 'application/json',
    }),
  });

  return handleResponse<ExplanationResponse>(response);
}

/**
 * POST /audit/{job_id}/candidate/{candidate_id}/perturb
 * Perform live "what-if" counterfactual perturbation test for a candidate
 */
export async function perturbCandidate(
  jobId: string,
  candidateId: string,
  field: string,
  newValue: any
): Promise<PerturbCandidateResponse> {
  const response = await fetch(`${API_BASE}/audit/${encodeURIComponent(jobId)}/candidate/${encodeURIComponent(candidateId)}/perturb`, {
    method: 'POST',
    headers: withAuth({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }),
    body: JSON.stringify({
      field,
      new_value: newValue,
    }),
  });

  return handleResponse<PerturbCandidateResponse>(response);
}

/**
 * POST /audit/{job_id}/fix
 * Trigger bias mitigation for a job
 */
export async function triggerFix(
  jobId: string,
  strategy: string = 'auto'
): Promise<TriggerFixResponse> {
  const response = await fetch(`${API_BASE}/audit/${jobId}/fix`, {
    method: 'POST',
    headers: withAuth({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }),
    body: JSON.stringify({
      strategy,
    }),
  });

  return handleResponse<TriggerFixResponse>(response);
}
