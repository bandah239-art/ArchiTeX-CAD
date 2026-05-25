import { API_BASE } from './apiConfig';

export interface VisionProcessResult {
  processed_image_base64: string;
  metadata: Record<string, unknown>;
  geo_context: Record<string, unknown>;
}

export interface VisionAnalysisResult {
  [key: string]: unknown;
}

export interface VisionCadResult {
  svg: string;
}

export interface VisionReportResult {
  report: string;
}

async function post<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(typeof detail?.detail === 'string' ? detail.detail : response.statusText);
  }
  return response.json() as Promise<T>;
}

export interface VisionImageInput {
  image_base64: string;
  image_source?: string;
  gps_latitude?: number | null;
  gps_longitude?: number | null;
  structure_hint?: string | null;
  country_code?: string;
  project_id?: string | null;
}

export const visionAPI = {
  processImage: (inputs: VisionImageInput) =>
    post<VisionProcessResult>('/vision/process-image', inputs),

  analyseStructure: (inputs: {
    image_base64: string;
    metadata: Record<string, unknown>;
    geo_context: Record<string, unknown>;
  }) => post<VisionAnalysisResult>('/vision/analyse', inputs),

  analyseMultiImage: (inputs: {
    images: string[];
    metadata: Record<string, unknown>;
    geo_context: Record<string, unknown>;
  }) => post<VisionAnalysisResult>('/vision/analyse-multi', inputs),

  generateCAD: (analysis: VisionAnalysisResult) =>
    post<VisionCadResult>('/vision/generate-cad', analysis),

  generateReport: (analysis: VisionAnalysisResult) =>
    post<VisionReportResult>('/vision/generate-report', analysis),
};
