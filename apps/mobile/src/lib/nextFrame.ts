/**
 * Double-rAF fence: resolves once a state update's render is committed AND at least one
 * frame has been presented.
 *
 * Both callers depend on the second frame specifically. The video export waits on it before
 * timing a beat's entering animations — starting the clock a frame early clips the front of
 * every animation in the recording. The replay screen waits on it before enabling entering
 * animations at all, because Reanimated drops animations scheduled on a screen's very first
 * frame (mid push-transition) and leaves the table half-painted until the next re-render.
 */
export const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
