import { post } from './api';

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
    post('/vision/process-image', inputs),
    
  analyseStructure: (inputs: { image_base64: string; metadata: any; geo_context: any }) =>
    post('/vision/analyse', inputs),
    
  analyseMultiImage: (inputs: { images: string[]; metadata: any; geo_context: any }) =>
    post('/vision/analyse-multi', inputs),
    
  generateCAD: (analysis: any) =>
    post('/vision/generate-cad', analysis),
    
  generateReport: (analysis: any) =>
    post('/vision/generate-report', analysis)
};
