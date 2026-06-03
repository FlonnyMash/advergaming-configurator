import { useSyncExternalStore } from "react";

export type SetState<T> = (
  partial: Partial<T> | ((state: T) => Partial<T>),
) => void;

export type GetState<T> = () => T;

export type StateCreator<T> = (set: SetState<T>, get: GetState<T>) => T;

export type StoreApi<T> = {
  getState: GetState<T>;
  setState: SetState<T>;
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
};

export type UseBoundStore<T> = {
  (): T;
  <U>(selector: (state: T) => U): U;
} & StoreApi<T>;

function applyPartial<T>(state: T, partial: Partial<T>): T {
  if (typeof partial !== "object" || partial === null) {
    return partial as T;
  }
  return { ...state, ...partial };
}

export function create<T>(createState: StateCreator<T>): UseBoundStore<T> {
  let state!: T;
  const listeners = new Set<(state: T, prevState: T) => void>();

  const getState: GetState<T> = () => state;

  const setState: SetState<T> = (partial) => {
    const patch =
      typeof partial === "function" ? partial(state) : partial;
    const prevState = state;
    const nextState = applyPartial(state, patch);
    if (Object.is(nextState, prevState)) {
      return;
    }
    state = nextState;
    for (const listener of listeners) {
      listener(state, prevState);
    }
  };

  state = createState(setState, getState);

  const subscribe = (listener: (state: T, prevState: T) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const api: StoreApi<T> = { getState, setState, subscribe };

  function useStore(): T;
  function useStore<U>(selector: (state: T) => U): U;
  function useStore<U>(selector?: (state: T) => U): T | U {
    const select = selector ?? ((value: T) => value as T | U);
    return useSyncExternalStore(
      (onStoreChange) =>
        subscribe(() => {
          onStoreChange();
        }),
      () => select(getState()),
      () => select(getState()),
    );
  }

  return Object.assign(useStore, api);
}
