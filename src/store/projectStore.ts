import { create } from 'zustand';
import type { Project } from '../types/project';

interface ProjectState {
  currentProject: Project | null;
  recentProjects: Project[];
  isLoading: boolean;
  openProject: (path: string) => void;
  saveProject: () => void;
  createNewProject: (name: string) => void;
  setCurrentProject: (project: Project | null) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  recentProjects: [],
  isLoading: false,

  openProject: (path: string) => {
    set({ isLoading: true });
    const project: Project = {
      id: crypto.randomUUID(),
      name: path.split(/[/\\]/).pop()?.replace('.ifc', '') || 'Untitled',
      path,
      ifcPath: path,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const recent = [project, ...get().recentProjects.filter((p) => p.path !== path)].slice(0, 10);
    set({ currentProject: project, recentProjects: recent, isLoading: false });
  },

  saveProject: () => {
    const current = get().currentProject;
    if (current) {
      set({
        currentProject: { ...current, updatedAt: new Date().toISOString() },
      });
    }
  },

  createNewProject: (name: string) => {
    const project: Project = {
      id: crypto.randomUUID(),
      name,
      path: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set({ currentProject: project });
  },

  setCurrentProject: (project) => set({ currentProject: project }),
}));
