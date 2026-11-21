import { Navigate, createBrowserRouter } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import LibraryPage from '@/pages/LibraryPage';
import ReaderPage from '@/pages/ReaderPage';
import SettingsPage from '@/pages/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <LibraryPage /> },
      { path: 'read/:id', element: <ReaderPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
