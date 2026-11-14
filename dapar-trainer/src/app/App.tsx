import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { MistakesPage } from '../pages/MistakesPage';
import { PracticePage } from '../pages/PracticePage';
import { ProgressPage } from '../pages/ProgressPage';
import { SimulationPage } from '../pages/SimulationPage';
import { systemPrefersDark, useSettings } from '../store/settings';
import { Layout } from './Layout';

function useApplyTheme() {
  const theme = useSettings((s) => s.theme);
  useEffect(() => {
    const dark = theme ? theme === 'dark' : systemPrefersDark();
    document.documentElement.classList.toggle('dark', dark);
  }, [theme]);
}

export function App() {
  useApplyTheme();
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="practice/:topic" element={<PracticePage />} />
          <Route path="simulation" element={<SimulationPage />} />
          <Route path="mistakes" element={<MistakesPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
