import type { Project } from '../../types/project';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <div className="p-4 rounded-lg bg-infra-accent/20 border border-infra-accent/30 hover:border-infra-highlight/40 transition-colors cursor-pointer">
      <h3 className="font-medium text-white truncate">{project.name}</h3>
      <p className="text-xs text-gray-500 mt-1 truncate">{project.path || 'No file'}</p>
      <p className="text-xs text-gray-600 mt-2">
        Updated {new Date(project.updatedAt).toLocaleDateString()}
      </p>
    </div>
  );
}
