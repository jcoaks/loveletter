import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import './styles.css';
import { MotionConfig } from 'motion/react';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { Placeholder } from './screens/Placeholder';

const lazyDefault = <T extends { default: React.ComponentType }>(load: () => Promise<T>) =>
  lazy(load);
const Home = lazy(() => import('./screens/entry/Home').then((m) => ({ default: m.HomeScreen })));
const RoomPage = lazyDefault(() => import('./screens/RoomPage'));
const Rules = lazyDefault(() => import('./screens/Rules'));

// La galería solo existe en desarrollo: en producción el bloque se elimina del paquete.
const Gallery = import.meta.env.DEV
  ? lazy(() => import('./screens/dev/Gallery').then((m) => ({ default: m.Gallery })))
  : null;

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/sala/:code', element: <RoomPage /> },
  { path: '/reglas', element: <Rules /> },
  ...(Gallery ? [{ path: '/dev/gallery', element: <Gallery /> }] : []),
  { path: '*', element: <Placeholder /> },
]);

const root = document.getElementById('root');
if (!root) throw new Error('Falta el elemento #root');

createRoot(root).render(
  <StrictMode>
    {/* Toda animación de Motion respeta la preferencia de movimiento reducido del sistema. */}
    <MotionConfig reducedMotion="user">
      <Suspense fallback={<div className="min-h-dvh" />}>
        <RouterProvider router={router} />
      </Suspense>
    </MotionConfig>
  </StrictMode>,
);
