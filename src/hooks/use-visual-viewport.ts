import { useSyncExternalStore } from 'react';

export interface VisualViewportState {
  height: number;
  offsetTop: number;
  isKeyboardOpen: boolean;
}

const SERVER_SNAPSHOT: VisualViewportState = {
  height: 0,
  offsetTop: 0,
  isKeyboardOpen: false,
};

let cachedSnapshot: VisualViewportState = SERVER_SNAPSHOT;

function readViewportState(): VisualViewportState {
  if (typeof window === 'undefined') {
    return SERVER_SNAPSHOT;
  }

  const vv = window.visualViewport;
  const rawHeight = vv ? vv.height : window.innerHeight;
  const height = Math.max(0, Math.round(rawHeight));
  const offsetTop = vv ? Math.max(0, Math.round(vv.offsetTop)) : 0;
  const isTouchViewport = window.innerWidth < 1024;
  const keyboardDiff = vv ? window.innerHeight - vv.height : 0;
  const isKeyboardOpen =
    isTouchViewport && (keyboardDiff > 120 || (height > 0 && height < 540));

  if (
    cachedSnapshot.height === height &&
    cachedSnapshot.offsetTop === offsetTop &&
    cachedSnapshot.isKeyboardOpen === isKeyboardOpen
  ) {
    return cachedSnapshot;
  }

  cachedSnapshot = { height, offsetTop, isKeyboardOpen };
  return cachedSnapshot;
}

function subscribeViewport(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const vv = window.visualViewport;
  window.addEventListener('resize', onStoreChange);
  vv?.addEventListener('resize', onStoreChange);
  vv?.addEventListener('scroll', onStoreChange);

  return () => {
    window.removeEventListener('resize', onStoreChange);
    vv?.removeEventListener('resize', onStoreChange);
    vv?.removeEventListener('scroll', onStoreChange);
  };
}

function getServerViewportSnapshot(): VisualViewportState {
  return SERVER_SNAPSHOT;
}

export function useVisualViewport(): VisualViewportState {
  return useSyncExternalStore(
    subscribeViewport,
    readViewportState,
    getServerViewportSnapshot
  );
}
