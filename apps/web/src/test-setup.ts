import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest corre sin globales, así que Testing Library no registra su propia limpieza.
afterEach(() => cleanup());
