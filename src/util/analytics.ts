/** Sends an event to Google Analytics. */
export function analyticsEvent(action: string, data?: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).gtag('event', action, data);
}
