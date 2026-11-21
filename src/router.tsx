import { Navigate, createBrowserRouter } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import LibraryPage from '@/pages/LibraryPage';
import ReaderPage from '@/pages/ReaderPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <LibraryPage /> },
      { path: 'read/:id', element: <ReaderPage /> },
      { path: 'settings', element: <Navigate to="/?settings=1" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
