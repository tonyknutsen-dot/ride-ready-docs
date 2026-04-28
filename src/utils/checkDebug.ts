type DebugValue = string | number | boolean | null | undefined;

type CheckDebugState = {
  markers: Record<string, string>;
  values: Record<string, DebugValue>;
};

const CANONICAL_DEBUG_ORIGIN = 'https://ridereadydocs.co.uk';
const EVENT_NAME = 'check-debug-update';

const getState = (): CheckDebugState => {
  if (typeof window === 'undefined') return { markers: {}, values: {} };
  const win = window as Window & { __CHECK_DEBUG__?: CheckDebugState };
  if (!win.__CHECK_DEBUG__) {
    win.__CHECK_DEBUG__ = { markers: {}, values: {} };
  }
  return win.__CHECK_DEBUG__;
};

export const isCheckDebugEnabled = () => {
  if (typeof window === 'undefined') return false;
  return window.location.origin === CANONICAL_DEBUG_ORIGIN && new URLSearchParams(window.location.search).get('checkDebug') === '1';
};

export const markCheckDebug = (marker: string, values?: Record<string, DebugValue>) => {
  if (!isCheckDebugEnabled()) return;
  const state = getState();
  state.markers[marker] = new Date().toLocaleTimeString('en-GB', { hour12: false });
  if (values) {
    Object.assign(state.values, values);
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
};

export const setCheckDebugValue = (key: string, value: DebugValue) => {
  if (!isCheckDebugEnabled()) return;
  const state = getState();
  state.values[key] = value;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
};

export const getCheckDebugSnapshot = () => getState();

export const CHECK_DEBUG_EVENT = EVENT_NAME;
