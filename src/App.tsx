import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { Home } from './pages/Home';
import { Programs } from './pages/Programs';
import { ProgramEdit } from './pages/ProgramEdit';
import { Generate } from './pages/Generate';
import { WorkoutPage } from './pages/Workout';
import { History } from './pages/History';
import { WorkoutDetail } from './pages/WorkoutDetail';
import { Exercises } from './pages/Exercises';
import { ExerciseDetail } from './pages/ExerciseDetail';
import { CustomExercise } from './pages/CustomExercise';
import { SettingsPage } from './pages/Settings';
import { CalendarIcon, DumbbellIcon, GearIcon, HistoryIcon, HomeIcon } from './components/Icons';

const tabs = [
  { to: '/', label: 'Today', icon: <HomeIcon /> },
  { to: '/programs', label: 'Splits', icon: <CalendarIcon /> },
  { to: '/history', label: 'History', icon: <HistoryIcon /> },
  { to: '/exercises', label: 'Exercises', icon: <DumbbellIcon /> },
  { to: '/settings', label: 'Settings', icon: <GearIcon /> },
];

export function App() {
  return (
    <HashRouter>
      <main className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/programs" element={<Programs />} />
          <Route path="/programs/generate" element={<Generate />} />
          <Route path="/programs/:id" element={<ProgramEdit />} />
          <Route path="/workout" element={<WorkoutPage />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<WorkoutDetail />} />
          <Route path="/history/:id/edit" element={<WorkoutPage />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/exercises/new" element={<CustomExercise />} />
          <Route path="/exercises/:id" element={<ExerciseDetail />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <nav className="tabbar">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'}>
            {t.icon}
            {t.label}
          </NavLink>
        ))}
      </nav>
    </HashRouter>
  );
}
