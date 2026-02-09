import { useCallback, useLayoutEffect, useRef } from 'react';

export function useEvent<T extends (...args: never[]) => unknown>(handler: T): T {
  const handlerRef = useRef(handler);

  useLayoutEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const stableHandler = useCallback((...args: Parameters<T>) => handlerRef.current(...args), []);
  return stableHandler as T;
}
