import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../../store/projectStore';
import { ProjectCard } from './ProjectCard';
import { RecentActivity } from './RecentActivity';

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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <button
            onClick={onOpenProject}
            className="p-8 rounded-xl border-2 border-dashed border-infra-accent/50 hover:border-infra-highlight/60 hover:bg-infra-accent/10 transition-all text-left group"
          >
            <div className="text-4xl mb-4">📂</div>
            <h2 className="text-xl font-semibold text-white mb-2 group-hover:text-infra-highlight transition-colors">
              Open IFC Project
            </h2>
            <p className="text-gray-400 text-sm">
              Load a BIM model and start structural calculations
            </p>
          </button>

          {hasProject && (
            <button
              onClick={onEnterWorkspace}
              className="p-8 rounded-xl bg-infra-accent/30 border border-infra-highlight/30 hover:bg-infra-accent/50 transition-all text-left"
            >
              <div className="text-4xl mb-4">🏗️</div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Continue Working
              </h2>
              <p className="text-gray-400 text-sm">
                Return to the BIM viewer and calculator workspace
              </p>
            </button>
          )}
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
