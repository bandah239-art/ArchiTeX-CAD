import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../../store/projectStore';
import { ProjectCard } from './ProjectCard';
import { RecentActivity } from './RecentActivity';
import { CadEngineStatusIndicator } from '../BIMViewer/CadEngineStatus';

interface ProjectDashboardProps {
  onOpenProject: () => void;
  onEnterWorkspace: () => void;
  hasProject: boolean;
}

export function ProjectDashboard({
  onOpenProject,
  onEnterWorkspace,
  hasProject,
}: ProjectDashboardProps) {
  const { t } = useTranslation();
  const { recentProjects } = useProjectStore();

  return (
    <div className="min-h-full bg-gradient-to-br from-infra-dark to-infra-darker p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
            ARCHITEX<span className="text-infra-highlight">-CAD</span>
          </h1>
          <p className="text-gray-400 text-lg">
            {t('app.tagline')} — Version 1.0
          </p>
          <CadEngineStatusIndicator className="mt-3" />
        </div>

        {hasProject && (
          <div className="mb-8">
            <button
              onClick={onEnterWorkspace}
              className="w-full p-6 rounded-xl bg-gradient-to-r from-infra-accent/30 to-infra-highlight/15 border border-infra-highlight/30 hover:from-infra-accent/40 hover:to-infra-highlight/25 transition-all text-left flex items-center gap-6 group shadow-lg"
            >
              <div className="text-4xl animate-pulse">🏗️</div>
              <div>
                <h2 className="text-xl font-bold text-white group-hover:text-infra-highlight transition-colors">
                  Continue Working
                </h2>
                <p className="text-gray-400 text-sm">
                  Return to the active BIM/CAD viewer and structural calculations workspace
                </p>
              </div>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <button
            onClick={onOpenProject}
            className="p-6 rounded-xl border border-dashed border-infra-accent/40 hover:border-infra-highlight/60 hover:bg-infra-accent/10 transition-all text-left group flex flex-col justify-between h-56"
          >
            <div>
              <div className="text-4xl mb-3">📐</div>
              <h2 className="text-base font-semibold text-white mb-1 group-hover:text-infra-highlight transition-colors">
                BIM / CAD / 3D Model
              </h2>
              <p className="text-gray-400 text-xs">
                Load and calculate 3D solids, plates, and frame assemblies
              </p>
            </div>
            <div className="text-[10px] text-gray-400 font-mono bg-black/40 p-2 rounded border border-infra-accent/20 w-full mt-3 space-y-2">
              <p className="text-center">IFC (full). DWG/DXF via server parser. STEP: preview</p>
              <CadEngineStatusIndicator />
            </div>
          </button>

          <button
            onClick={onOpenProject}
            className="p-6 rounded-xl border border-dashed border-infra-accent/40 hover:border-infra-highlight/60 hover:bg-infra-accent/10 transition-all text-left group flex flex-col justify-between h-56"
          >
            <div>
              <div className="text-4xl mb-3">🗺️</div>
              <h2 className="text-base font-semibold text-white mb-1 group-hover:text-infra-highlight transition-colors">
                GIS / Terrain Layer
              </h2>
              <p className="text-gray-400 text-xs">
                Import map boundaries for topographical site analytics
              </p>
            </div>
            <div className="text-[10px] text-gray-400 font-mono bg-black/40 p-2 rounded border border-infra-accent/20 w-full text-center mt-3">
              GeoJSON, JSON, Shapefiles
            </div>
          </button>

          <button
            onClick={onOpenProject}
            className="p-6 rounded-xl border border-dashed border-infra-accent/40 hover:border-infra-highlight/60 hover:bg-infra-accent/10 transition-all text-left group flex flex-col justify-between h-56"
          >
            <div>
              <div className="text-4xl mb-3">📊</div>
              <h2 className="text-base font-semibold text-white mb-1 group-hover:text-infra-highlight transition-colors">
                Excel / CSV Spreadsheet
              </h2>
              <p className="text-gray-400 text-xs">
                Import structural quantities schedules into BoQ calculators
              </p>
            </div>
            <div className="text-[10px] text-gray-400 font-mono bg-black/40 p-2 rounded border border-infra-accent/20 w-full text-center mt-3">
              CSV, XLSX, XLS
            </div>
          </button>
        </div>

        {recentProjects.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Projects</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </section>
        )}

        <RecentActivity />
      </div>
    </div>
  );
}
