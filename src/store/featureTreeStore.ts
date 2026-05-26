import { create } from 'zustand';
import { FeatureTree, type Feature } from '../cad/history/FeatureTree';

interface FeatureTreeState {
  featureTree: FeatureTree;
  features: Feature[];
  selectedFeatureId: string | null;
  activeSolidMesh: any | null; // compiled 3D shape output for WebGL
  isRebuilding: boolean;
  rebuildTree: () => Promise<void>;
  addFeature: (f: Feature) => void;
  removeFeature: (id: string) => void;
  updateFeatureInputs: (id: string, inputs: any) => void;
  selectFeature: (id: string | null) => void;
}

export const useFeatureTreeStore = create<FeatureTreeState>((set, get) => {
  const tree = new FeatureTree();
  return {
    featureTree: tree,
    features: [],
    selectedFeatureId: null,
    activeSolidMesh: null,
    isRebuilding: false,
    
    rebuildTree: async () => {
      set({ isRebuilding: true });
      try {
        await tree.rebuild();
        // find last built 3D mesh to render
        const all = tree.getFeatures();
        let lastSolidMesh = null;
        for (let i = all.length - 1; i >= 0; i--) {
          const feature = all[i];
          const out = feature.output;
          if (feature.type !== 'sketch' && feature.status === 'built' && out && out.vertices && out.vertices.length > 0) {
            lastSolidMesh = out;
            break;
          }
        }
        set({
          features: tree.getFeatures(),
          activeSolidMesh: lastSolidMesh,
        });
      } catch (err) {
        console.error("Rebuild failed:", err);
      } finally {
        set({ isRebuilding: false });
      }
    },
    
    addFeature: (f) => {
      tree.addFeature(f);
      set({ features: tree.getFeatures() });
      get().rebuildTree();
    },
    
    removeFeature: (id) => {
      tree.removeFeature(id);
      set({ features: tree.getFeatures() });
      get().rebuildTree();
    },
    
    updateFeatureInputs: (id, inputs) => {
      tree.updateFeature(id, inputs);
      set({ features: tree.getFeatures() });
      get().rebuildTree();
    },
    
    selectFeature: (id) => set({ selectedFeatureId: id }),
  };
});
