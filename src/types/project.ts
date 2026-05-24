export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  ifcPath?: string;
  description?: string;
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  action: string;
  timestamp: string;
}
