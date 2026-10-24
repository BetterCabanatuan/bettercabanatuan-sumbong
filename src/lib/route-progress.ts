/**
 * The top progress bar (`<RouteProgress>`) starts on its own when a Link is clicked. Code that
 * moves the router without a Link — the board's filters, the language toggle — says so here.
 */
export type RouteProgressEvent = "start" | "finish";

type Listener = (event: RouteProgressEvent) => void;

const listeners = new Set<Listener>();

function emit(event: RouteProgressEvent) {
  for (const listener of listeners) listener(event);
}

export function startRouteProgress() {
  emit("start");
}

export function finishRouteProgress() {
  emit("finish");
}

/** Subscribes the bar. Returns the function that unsubscribes it. */
export function subscribeRouteProgress(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
