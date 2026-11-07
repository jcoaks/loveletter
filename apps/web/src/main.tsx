import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import './styles.css';
import { MotionConfig } from 'motion/react';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, useRouteError } from 'react-router';
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

// Tras un despliegue, una pestaña abierta pide fragmentos con hash que ya no existen: se recarga
// una sola vez para traer la versión nueva (la marca evita un bucle si el fallo es otro).
const RELOAD_KEY = 'll-chunk-reload';
const reloadForNewVersion = () => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 10_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
};
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

const isChunkError = (error: unknown) =>
  error instanceof Error &&
  /dynamically imported module|Importing a module script failed/i.test(error.message);

function RouteError() {
  const error = useRouteError();
  if (isChunkError(error) && reloadForNewVersion()) return <div className="min-h-dvh" />;
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="mb-4">Algo salió mal al cargar la página.</p>
        <button type="button" className="ll-play" onClick={() => window.location.reload()}>
          Recargar
        </button>
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  { path: '/', element: <Home />, errorElement: <RouteError /> },
  { path: '/sala/:code', element: <RoomPage />, errorElement: <RouteError /> },
  { path: '/reglas', element: <Rules />, errorElement: <RouteError /> },
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
