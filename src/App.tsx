import { useState } from 'react';
import { AppShell } from './components/Layout/AppShell';
import { ProjectDashboard } from './components/Dashboard/ProjectDashboard';
import { useProject } from './hooks/useProject';

type View = 'dashboard' | 'workspace';

function App() {
  const [view, setView] = useState<View>('dashboard');
  const { currentProject, openIFC } = useProject();

  const handleOpenProject = async () => {
    await openIFC();
    setView('workspace');
  };

  const handleOpenWorkspace = () => {
    if (currentProject) setView('workspace');
  };

  return view === 'dashboard' ? (
    <ProjectDashboard
      onOpenProject={handleOpenProject}
      onEnterWorkspace={handleOpenWorkspace}
      hasProject={!!currentProject}
    />
  ) : (
    <AppShell onBackToDashboard={() => setView('dashboard')} />
  );
}

export default App;
