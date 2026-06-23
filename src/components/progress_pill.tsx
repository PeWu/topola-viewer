import {AppState} from '../pages/view_page';

interface ProgressPillProps {
  loadingStatus: string;
  state: AppState;
}

/**
 * ProgressPill displays a small, fixed status indicator in the bottom-left corner
 * showing the current data loading or rendering status.
 */
export function ProgressPill({loadingStatus, state}: ProgressPillProps) {
  if (
    !loadingStatus ||
    (state !== AppState.LOADING && state !== AppState.SHOWING_CHART)
  ) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        background: 'rgba(0,0,0,0.7)',
        color: '#fff',
        padding: '6px 12px',
        borderRadius: 4,
        fontFamily: 'monospace',
        fontSize: 12,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {loadingStatus}
    </div>
  );
}
