import { lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';

const LibraryPage = lazy(() => import('@/pages/LibraryPage'));
const ReaderPage = lazy(() => import('@/pages/ReaderPage'));

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
