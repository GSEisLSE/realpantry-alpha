export const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday'];

export function upcomingMondayISO(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const delta = day === 0 ? 1 : (8 - day) % 7 || 7;
  d.setDate(d.getDate() + delta);
  d.setHours(12,0,0,0);
  return d.toISOString().slice(0,10);
}

export function nextWeekISO(weekStart) {
  const d = new Date(`${weekStart}T12:00:00`);
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0,10);
}

export function displayWeek(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined,{month:'short',day:'numeric'});
}

export function eatenFraction(outcome) {
  return ({ all:1, most:.8, half:.5, little:.2, none:0 })[outcome] ?? null;
}
