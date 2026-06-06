import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectStore } from '../store/projectStore';

// Mock the offline cache so tests don't hit the filesystem
vi.mock('../services/offlineCache', () => ({
  saveProjectMetaLocal: vi.fn(),
  loadProjectMetaLocal: vi.fn(() => null),
}));

beforeEach(() => {
  useProjectStore.setState({
    currentProject: null,
    recentProjects: [],
    isLoading: false,
    hasUnsavedChanges: false,
    lastSavedAt: null,
  });
});

describe('projectStore — project lifecycle', () => {
  it('starts with no current project', () => {
    expect(useProjectStore.getState().currentProject).toBeNull();
  });

  it('openProject sets currentProject', () => {
    useProjectStore.getState().openProject('C:/projects/clinic.ifc');
    expect(useProjectStore.getState().currentProject).not.toBeNull();
    expect(useProjectStore.getState().currentProject?.name).toBe('clinic');
  });

  it('openProject adds to recentProjects', () => {
    useProjectStore.getState().openProject('C:/projects/clinic.ifc');
    expect(useProjectStore.getState().recentProjects).toHaveLength(1);
  });

  it('opening same path twice keeps only one entry in recents', () => {
    useProjectStore.getState().openProject('C:/projects/clinic.ifc');
    useProjectStore.getState().openProject('C:/projects/clinic.ifc');
    expect(useProjectStore.getState().recentProjects).toHaveLength(1);
  });

  it('createNewProject sets project with given name', () => {
    useProjectStore.getState().createNewProject('Ndola School');
    expect(useProjectStore.getState().currentProject?.name).toBe('Ndola School');
  });

  it('saveProject updates updatedAt and clears unsaved flag', () => {
    useProjectStore.getState().openProject('C:/projects/test.ifc');
    useProjectStore.setState({ hasUnsavedChanges: true });
    useProjectStore.getState().saveProject();
    expect(useProjectStore.getState().hasUnsavedChanges).toBe(false);
    expect(useProjectStore.getState().lastSavedAt).not.toBeNull();
  });

  it('setCurrentProject updates state', () => {
    const proj = {
      id: 'x1', name: 'Test', path: '', createdAt: '', updatedAt: '',
    };
    useProjectStore.getState().setCurrentProject(proj);
    expect(useProjectStore.getState().currentProject?.id).toBe('x1');
  });
});

describe('projectStore — unsaved changes tracking', () => {
  it('markUnsaved sets hasUnsavedChanges to true', () => {
    useProjectStore.getState().markUnsaved();
    expect(useProjectStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('markSaved clears hasUnsavedChanges', () => {
    useProjectStore.setState({ hasUnsavedChanges: true });
    useProjectStore.getState().markSaved();
    expect(useProjectStore.getState().hasUnsavedChanges).toBe(false);
  });

  it('markSaved records lastSavedAt timestamp', () => {
    useProjectStore.getState().markSaved();
    const saved = useProjectStore.getState().lastSavedAt;
    expect(saved).not.toBeNull();
    expect(new Date(saved!).getTime()).toBeGreaterThan(0);
  });

  it('starts with hasUnsavedChanges false', () => {
    expect(useProjectStore.getState().hasUnsavedChanges).toBe(false);
  });
});

describe('projectStore — recent projects limit', () => {
  it('caps recentProjects at 10', () => {
    for (let i = 0; i < 15; i++) {
      useProjectStore.getState().openProject(`C:/projects/project${i}.ifc`);
    }
    expect(useProjectStore.getState().recentProjects.length).toBeLessThanOrEqual(10);
  });
});
