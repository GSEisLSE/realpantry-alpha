/**
 * Real Pantry Alpha Recommendation Engine v2
 *
 * Purpose: rank lunches for one child and optimize a Monday-Friday week.
 * This replaces the old "filter + random pick" behavior with:
 *   hard safety filters -> child acceptance -> nutrition gate -> weekly variety
 *   -> family fit -> practicality -> controlled exploration.
 *
 * The engine is intentionally data-source agnostic. It can sit behind the
 * existing React UI now and later read/write from Supabase/Postgres.
 */

const PRIOR_BY_STATUS = {
  loves:    { p: 0.92, strength: 4 },
  likes:    { p: 0.78, strength: 4 },
  okay:     { p: 0.60, strength: 3 },
  unknown:  { p: 0.50, strength: 2 },
  exposure: { p: 0.38, strength: 2 },
  avoid:    { p: 0.05, strength: 8 },
};

const DEFAULT_CONFIG = {
  minNutritionScore: 60,
  maxExposureItemsPerLunch: 1,
  reliableThreshold: 0.60,
  exposureThreshold: 0.45,
  weights: {
    acceptance: 0.40,
    nutrition: 0.25,
    variety: 0.15,
    familyFit: 0.10,
    practicality: 0.10,
  },
  repeatPenalties: {
    sameMainThisWeek: 35,
    sameFruitThirdTime: 15,
    sameVegThirdTime: 15,
    sameOtherThirdTime: 10,
    recentFood: 8,
  },
};

function clamp(n, min = 0, max = 1) {
  return Math.max(min, Math.min(max, n));
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Bayesian-ish acceptance estimate.
 * Parent seed answers form the prior; actual packed-lunch outcomes update it.
 * Each outcome eaten_fraction is 0..1.
 */
function acceptanceProbability(foodId, childFoodStats = {}) {
  const stat = childFoodStats[foodId] || {};
  const status = stat.status || "unknown";
  const prior = PRIOR_BY_STATUS[status] || PRIOR_BY_STATUS.unknown;

  let alpha = prior.p * prior.strength;
  let beta = (1 - prior.p) * prior.strength;

  for (const obs of stat.outcomes || []) {
    if (obs == null || obs.eaten_fraction == null) continue;
    const f = clamp(Number(obs.eaten_fraction));
    const weight = obs.weight == null ? 1 : Math.max(0, Number(obs.weight));
    alpha += f * weight;
    beta += (1 - f) * weight;
  }

  return alpha / (alpha + beta);
}

function itemAcceptance(item, childFoodStats) {
  return acceptanceProbability(item.food_id, childFoodStats);
}

function hasBlockedAllergen(item, blockedAllergens) {
  const blocked = new Set((blockedAllergens || []).map(normalizeText));
  return (item.allergens || []).some((a) => blocked.has(normalizeText(a)));
}

function violatesRestriction(item, blockedTags) {
  const blocked = new Set((blockedTags || []).map(normalizeText));
  return (item.tags || []).some((t) => blocked.has(normalizeText(t)));
}

function safetyCheck(lunch, child = {}) {
  const items = lunch.items || [];
  const blockedAllergens = child.allergens || [];
  const blockedTags = child.blocked_tags || [];

  for (const item of items) {
    if (hasBlockedAllergen(item, blockedAllergens)) {
      return { ok: false, reason: `blocked allergen in ${item.name}` };
    }
    if (violatesRestriction(item, blockedTags)) {
      return { ok: false, reason: `blocked restriction in ${item.name}` };
    }
  }
  return { ok: true };
}

function preferenceHardCheck(lunch, childFoodStats = {}) {
  for (const item of lunch.items || []) {
    const stat = childFoodStats[item.food_id];
    if (stat && stat.status === "avoid") {
      return { ok: false, reason: `parent-marked avoid food: ${item.name}` };
    }
  }
  return { ok: true };
}

function roleCounts(items) {
  const out = {};
  for (const item of items || []) {
    const role = item.role || "other";
    out[role] = (out[role] || 0) + 1;
  }
  return out;
}

function lunchAcceptanceScore(lunch, childFoodStats = {}) {
  const items = lunch.items || [];
  if (!items.length) return { score: 0, probabilities: [] };

  // Main is slightly more important than a side because a rejected main can
  // turn an otherwise good lunch into a poor school-day experience.
  let weighted = 0;
  let totalWeight = 0;
  const probabilities = [];

  for (const item of items) {
    const p = itemAcceptance(item, childFoodStats);
    const weight = item.role === "main" ? 1.5 : 1;
    probabilities.push({ food_id: item.food_id, name: item.name, role: item.role, p });
    weighted += p * weight;
    totalWeight += weight;
  }

  return { score: (weighted / totalWeight) * 100, probabilities };
}

function controlledExplorationCheck(lunch, probabilities, config) {
  const exposureItems = probabilities.filter((x) => x.p < config.exposureThreshold);
  const reliableItems = probabilities.filter((x) => x.p >= config.reliableThreshold);
  const main = probabilities.find((x) => x.role === "main");

  if (exposureItems.length > config.maxExposureItemsPerLunch) {
    return { ok: false, reason: "too many low-confidence foods" };
  }

  // Require a reliable anchor: reliable main OR at least two reliable items.
  if (!((main && main.p >= config.reliableThreshold) || reliableItems.length >= 2)) {
    return { ok: false, reason: "no reliable acceptance anchor" };
  }

  return { ok: true, exposureItems, reliableItems };
}

function countRoleFood(weekState, role, foodId) {
  return (weekState.selectedItems || []).filter(
    (x) => x.role === role && x.food_id === foodId
  ).length;
}

function varietyScore(lunch, weekState = {}, recentFoodIds = []) {
  const recent = new Set(recentFoodIds || []);
  let score = 100;

  for (const item of lunch.items || []) {
    const thisWeekCount = (weekState.foodCounts && weekState.foodCounts[item.food_id]) || 0;
    if (thisWeekCount > 0) score -= 10 * thisWeekCount;
    if (recent.has(item.food_id)) score -= 6;

    if (item.role === "fruit" && countRoleFood(weekState, "fruit", item.food_id) >= 2) score -= 12;
    if (item.role === "veg" && countRoleFood(weekState, "veg", item.food_id) >= 2) score -= 12;
  }

  return Math.max(0, score);
}

function scoreLunch(lunch, context = {}) {
  const config = {
    ...DEFAULT_CONFIG,
    ...(context.config || {}),
    weights: { ...DEFAULT_CONFIG.weights, ...((context.config || {}).weights || {}) },
  };

  const safety = safetyCheck(lunch, context.child || {});
  if (!safety.ok) return { eligible: false, reason: safety.reason, lunch };

  const preferenceSafety = preferenceHardCheck(lunch, context.childFoodStats || {});
  if (!preferenceSafety.ok) return { eligible: false, reason: preferenceSafety.reason, lunch };

  const nutrition = Number(lunch.nutrition_score == null ? 0 : lunch.nutrition_score);
  if (nutrition < config.minNutritionScore) {
    return { eligible: false, reason: "nutrition below minimum", lunch };
  }

  const acceptance = lunchAcceptanceScore(lunch, context.childFoodStats || {});
  const exploration = controlledExplorationCheck(lunch, acceptance.probabilities, config);
  if (!exploration.ok) return { eligible: false, reason: exploration.reason, lunch };

  const variety = varietyScore(
    lunch,
    context.weekState || {},
    context.recentFoodIds || []
  );

  const familyFit = Number(lunch.family_fit_score == null ? 75 : lunch.family_fit_score);
  const practicality = Number(lunch.practicality_score == null ? 75 : lunch.practicality_score);

  const weighted =
    acceptance.score * config.weights.acceptance +
    nutrition * config.weights.nutrition +
    variety * config.weights.variety +
    familyFit * config.weights.familyFit +
    practicality * config.weights.practicality;

  return {
    eligible: true,
    lunch,
    totalScore: Math.round(weighted * 10) / 10,
    subScores: {
      acceptance: Math.round(acceptance.score),
      nutrition: Math.round(nutrition),
      variety: Math.round(variety),
      familyFit: Math.round(familyFit),
      practicality: Math.round(practicality),
    },
    acceptanceProbabilities: acceptance.probabilities,
    exposureItems: exploration.exposureItems,
    explanation: buildExplanation({ acceptance, nutrition, variety, familyFit, practicality, exploration }),
  };
}

function buildExplanation({ acceptance, nutrition, variety, familyFit, practicality, exploration }) {
  const lines = [];
  if (acceptance.score >= 80) lines.push("High acceptance confidence");
  else if (acceptance.score >= 65) lines.push("Moderate acceptance confidence");
  else lines.push("Some acceptance uncertainty");

  if (nutrition >= 85) lines.push("Strong nutrition profile");
  else if (nutrition >= 70) lines.push("Solid nutrition profile");

  if (variety >= 85) lines.push("Adds useful weekly variety");
  if (familyFit >= 85) lines.push("Strong match for family standards");
  if (practicality >= 85) lines.push("Easy school-day prep");

  if ((exploration.exposureItems || []).length === 1) {
    lines.push(`Includes one gentle exposure: ${exploration.exposureItems[0].name}`);
  }
  return lines;
}

function addLunchToWeekState(weekState, lunch) {
  const next = {
    mains: new Set(weekState.mains || []),
    foodCounts: { ...(weekState.foodCounts || {}) },
    selectedItems: [...(weekState.selectedItems || [])],
  };

  for (const item of lunch.items || []) {
    next.foodCounts[item.food_id] = (next.foodCounts[item.food_id] || 0) + 1;
    next.selectedItems.push({ food_id: item.food_id, role: item.role });
    if (item.role === "main") next.mains.add(item.food_id);
  }
  return next;
}

function weeklyRepeatPenalty(lunch, weekState, config = DEFAULT_CONFIG) {
  let penalty = 0;
  for (const item of lunch.items || []) {
    const count = (weekState.foodCounts && weekState.foodCounts[item.food_id]) || 0;
    if (item.role === "main" && count >= 1) penalty += config.repeatPenalties.sameMainThisWeek;
    if (item.role === "fruit" && count >= 2) penalty += config.repeatPenalties.sameFruitThirdTime;
    if (item.role === "veg" && count >= 2) penalty += config.repeatPenalties.sameVegThirdTime;
    if (item.role === "other" && count >= 2) penalty += config.repeatPenalties.sameOtherThirdTime;
  }
  return penalty;
}

/**
 * Greedy Monday-Friday optimizer.
 * Good enough for an alpha and easy to explain/debug.
 * A future production engine could use constraint programming/ILP if needed.
 */
function generateWeek({
  candidates,
  child,
  childFoodStats,
  recentFoodIds = [],
  lockedByDay = {},
  days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  config = {},
}) {
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    weights: { ...DEFAULT_CONFIG.weights, ...(config.weights || {}) },
    repeatPenalties: { ...DEFAULT_CONFIG.repeatPenalties, ...(config.repeatPenalties || {}) },
  };

  let weekState = { mains: new Set(), foodCounts: {}, selectedItems: [] };
  const plan = {};
  const usedLunchIds = new Set();

  for (const day of days) {
    if (lockedByDay[day]) {
      plan[day] = { ...scoreLunch(lockedByDay[day], { child, childFoodStats, weekState, recentFoodIds, config: mergedConfig }), locked: true };
      weekState = addLunchToWeekState(weekState, lockedByDay[day]);
      usedLunchIds.add(lockedByDay[day].id);
      continue;
    }

    let scored = candidates
      .filter((c) => !usedLunchIds.has(c.id))
      .map((lunch) => scoreLunch(lunch, { child, childFoodStats, weekState, recentFoodIds, config: mergedConfig }))
      .filter((x) => x.eligible);

    // Prefer a unique main as a hard weekly rule when any eligible unique-main
    // candidate exists. Only relax this rule if the candidate pool cannot fill
    // the week, which is useful during a tiny alpha catalog.
    const uniqueMain = scored.filter((x) => {
      const main = (x.lunch.items || []).find((i) => i.role === "main");
      return !main || !weekState.mains.has(main.food_id);
    });
    if (uniqueMain.length > 0) scored = uniqueMain;

    const ranked = scored
      .map((x) => ({
        ...x,
        marginalScore: x.totalScore - weeklyRepeatPenalty(x.lunch, weekState, mergedConfig),
      }))
      .sort((a, b) => b.marginalScore - a.marginalScore);

    if (!ranked.length) {
      plan[day] = { eligible: false, reason: "no eligible lunch", lunch: null };
      continue;
    }

    const pick = ranked[0];
    plan[day] = pick;
    usedLunchIds.add(pick.lunch.id);
    weekState = addLunchToWeekState(weekState, pick.lunch);
  }

  return {
    plan,
    weekSummary: summarizeWeek(plan),
  };
}

function summarizeWeek(plan) {
  const selected = Object.values(plan).filter((x) => x && x.eligible && x.lunch);
  if (!selected.length) return { daysPlanned: 0 };

  const avg = (key) => Math.round(selected.reduce((s, x) => s + (x.subScores[key] || 0), 0) / selected.length);
  const uniqueFoods = new Set();
  const exposureFoods = new Set();
  selected.forEach((x) => {
    (x.lunch.items || []).forEach((i) => uniqueFoods.add(i.food_id));
    (x.exposureItems || []).forEach((i) => exposureFoods.add(i.food_id));
  });

  return {
    daysPlanned: selected.length,
    averageAcceptance: avg("acceptance"),
    averageNutrition: avg("nutrition"),
    averageVariety: avg("variety"),
    uniqueFoods: uniqueFoods.size,
    exposureFoods: [...exposureFoods],
  };
}

export {
  PRIOR_BY_STATUS,
  DEFAULT_CONFIG,
  acceptanceProbability,
  scoreLunch,
  generateWeek,
  summarizeWeek,
};
