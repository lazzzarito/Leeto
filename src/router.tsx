import { lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';

const LegalPage = lazy(() => import('@/pages/LegalPage'));
const LibraryPage = lazy(() => import('@/pages/LibraryPage'));
const ReaderPage = lazy(() => import('@/pages/ReaderPage'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <LibraryPage /> },
      { path: 'legal', element: <LegalPage /> },
      { path: 'read/:id', element: <ReaderPage /> },
      { path: 'settings', element: <Navigate to="/?settings=1" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
