import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const CHUNK_RELOAD_FLAG = 'trendmix:chunk-reload-once';

const isRecoverableChunkError = (error: unknown): boolean => {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('chunkloaderror') ||
    message.includes('loading chunk') ||
    message.includes('dynamically imported module')
  );
};

export const lazyWithRetry = <T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
): LazyExoticComponent<T> => lazy(async () => {
  try {
    const module = await importer();

    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
    }

    return module;
  } catch (error) {
    if (typeof window !== 'undefined' && isRecoverableChunkError(error)) {
      const hasReloaded = window.sessionStorage.getItem(CHUNK_RELOAD_FLAG) === '1';

      if (!hasReloaded) {
        window.sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
        window.location.reload();
        return new Promise<never>(() => {});
      }

      window.sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
    }

    throw error;
  }
});
