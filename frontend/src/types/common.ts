/**
 * Common TypeScript interfaces for Checksum application.
 */

// Machine-readable backend error response shape
export interface ApiErrorPayload {
  error_code: string;
  detail: string;
  job_id?: string;
  status_code?: number;
  timestamp?: string;
  context?: Record<string, unknown>;
}

// Common Sort Direction
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  column: string;
  direction: SortDirection;
}

// Stage progress interface
export interface JobStage {
  id: string;
  label: string;
  description?: string;
  status: 'pending' | 'running' | 'done' | 'failed';
}
