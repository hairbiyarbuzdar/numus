/**
 * Cache bookkeeping for a module that loads its data when it is first opened
 * rather than at login.
 *
 * Kept out of the React providers (see context/ProductContext.tsx and
 * context/UsersContext.tsx) for two reasons: both providers need exactly the
 * same rules, and the rules are worth testing on their own — the flags have to
 * be readable in the same tick they are written, which React state is not.
 */
export interface LazyFetch {
  /** True once a run has completed successfully. */
  isLoaded: () => boolean;
  /** Runs the fetcher, unless an identical run is already in flight. */
  run: (fetcher: () => Promise<void>) => Promise<void>;
  /** Runs the fetcher only if there is nothing cached yet. */
  ensure: (fetcher: () => Promise<void>) => Promise<void>;
  /** Drops the cache — e.g. a different user signed in. */
  invalidate: () => void;
}

export const createLazyFetch = (): LazyFetch => {
  let loaded = false;
  let inFlight: Promise<void> | null = null;

  const run = (fetcher: () => Promise<void>) => {
    // Several components mounting at once must produce one request, not one each.
    if (inFlight) return inFlight;

    const request = (async () => {
      try {
        await fetcher();
        loaded = true;
      } finally {
        inFlight = null;
      }
    })();

    inFlight = request;
    return request;
  };

  return {
    isLoaded: () => loaded,
    run,
    ensure: (fetcher) => (loaded ? Promise.resolve() : run(fetcher)),
    invalidate: () => {
      loaded = false;
      inFlight = null;
    },
  };
};
