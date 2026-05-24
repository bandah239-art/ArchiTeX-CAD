import type { IFCElement, ModelStats } from '../../types/ifc';

export interface BIMViewerProps {
  modelPath: string | null;
  onElementSelected: (element: IFCElement) => void;
  onModelLoaded: (stats: ModelStats) => void;
  activeStorey: number | null;
  hiddenLayers: string[];
}

export interface ViewerToolbarAction {
  id: string;
  label: string;
  icon: string;
  action: () => void;
}
