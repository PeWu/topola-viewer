/** Sends an event to Google Analytics. */
export function analyticsEvent(action: string, data?: any) {
  (window as any).gtag('event', action, data);
}
