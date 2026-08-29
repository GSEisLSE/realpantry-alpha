const STORAGE_KEY = 'realpantry.alpha.v3';
const LEGACY_STORAGE_KEY = 'realpantry.alpha.v2';
const EVENT_KEY = 'realpantry.alpha.events.v3';
const LEGACY_EVENT_KEY = 'realpantry.alpha.events.v2';

export function emptyState() {
  return {
    version: 3,
    household: {
      weeklyBudget: 40,
      preferredStores: [],
      maxPrepMinutes: 15,
      baselinePlanningMinutes: 30,
      valuesProfile: { organic: 2, avoidSyntheticDyes: 3, seedOilAvoidance: 0, minimalPlastic: 1 },
    },
    children: [],
    activeChildId: null,
    foodSeeds: {},
    weeks: {},
    outcomes: [],
    cloud: { householdId: null, lastSyncedAt: null },
    ui: { step: 0, currentWeekStart: null },
  };
}

export function normalizeState(input = {}) {
  const base = emptyState();
  return {
    ...base,
    ...input,
    version: 3,
    household: { ...base.household, ...(input.household || {}) },
    cloud: { ...base.cloud, ...(input.cloud || {}) },
    ui: { ...base.ui, ...(input.ui || {}) },
    children: Array.isArray(input.children) ? input.children : [],
    foodSeeds: input.foodSeeds || {},
    weeks: input.weeks || {},
    outcomes: Array.isArray(input.outcomes) ? input.outcomes : [],
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : emptyState();
  } catch {
    return emptyState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  localStorage.removeItem(EVENT_KEY);
  localStorage.removeItem(LEGACY_EVENT_KEY);
}

export function track(name, payload = {}) {
  const event = { name, payload, at: new Date().toISOString() };
  const oldEvents = JSON.parse(localStorage.getItem(EVENT_KEY) || localStorage.getItem(LEGACY_EVENT_KEY) || '[]');
  oldEvents.push(event);
  localStorage.setItem(EVENT_KEY, JSON.stringify(oldEvents.slice(-1000)));
  window.dispatchEvent(new CustomEvent('realpantry:alpha-event', { detail: event }));
  return event;
}

export function getEvents() {
  return JSON.parse(localStorage.getItem(EVENT_KEY) || localStorage.getItem(LEGACY_EVENT_KEY) || '[]');
}
