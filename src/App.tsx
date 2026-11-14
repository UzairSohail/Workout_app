import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { Programs } from './pages/Programs';
import { ProgramEdit } from './pages/ProgramEdit';
import { Generate } from './pages/Generate';
import { ImportPlan } from './pages/ImportPlan';
import { WorkoutPage } from './pages/Workout';
import { History } from './pages/History';
import { WorkoutDetail } from './pages/WorkoutDetail';
import { Exercises } from './pages/Exercises';
import { ExerciseDetail } from './pages/ExerciseDetail';
import { CustomExercise } from './pages/CustomExercise';
import { SettingsPage } from './pages/Settings';
import { RecordsPage } from './pages/Records';
import { WeightPage } from './pages/Weight';
import { StartPage } from './pages/Start';
import { UndoBar } from './components/UndoBar';
import { CalendarIcon, DumbbellIcon, HistoryIcon, HomeIcon, SlidersIcon } from './components/Icons';

const tabs = [
  { to: '/', label: 'Today', icon: <HomeIcon /> },
  { to: '/programs', label: 'Splits', icon: <CalendarIcon /> },
  { to: '/history', label: 'History', icon: <HistoryIcon /> },
  { to: '/exercises', label: 'Exercises', icon: <DumbbellIcon /> },
  { to: '/settings', label: 'Settings', icon: <SlidersIcon /> },
];

/** Logging a workout gets the whole screen; the tab bar comes back when you leave it. */
const fullScreen = (path: string) => path === '/workout' || /^\/history\/[^/]+\/edit$/.test(path);

function Shell() {
  const { pathname } = useLocation();
  const hideTabs = fullScreen(pathname);
  return (
    <>
      <main className={`page ${hideTabs ? 'no-tabs' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/programs" element={<Programs />} />
          <Route path="/programs/generate" element={<Generate />} />
          <Route path="/programs/:id" element={<ProgramEdit />} />
          <Route path="/import" element={<ImportPlan />} />
          <Route path="/start" element={<StartPage />} />
          <Route path="/workout" element={<WorkoutPage />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<WorkoutDetail />} />
          <Route path="/history/:id/edit" element={<WorkoutPage />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/exercises/new" element={<CustomExercise />} />
          <Route path="/exercises/:id" element={<ExerciseDetail />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/:section" element={<SettingsPage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/weight" element={<WeightPage />} />
        </Routes>
      </main>
      <UndoBar />
      {!hideTabs && (
        <nav className="tabbar" aria-label="Main">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.to === '/'}>
              <span className="tab-ico">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </nav>
      )}
    </>
  );
}

export function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
