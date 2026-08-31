import { generateWeek, scoreLunch } from './recommendationEngine.js';
import { lunchCandidates } from '../data/catalog.js';
import { DAYS } from './week.js';

export function buildChildStats(childId, foodSeeds, outcomes) {
  const seed = foodSeeds[childId] || {};
  const stats = {};
  Object.entries(seed).forEach(([foodId,status]) => {
    stats[foodId] = { status, outcomes: [] };
  });
  outcomes.filter(o => o.childId === childId).forEach(o => {
    if (!stats[o.foodId]) stats[o.foodId] = { status:'unknown', outcomes:[] };
    stats[o.foodId].outcomes.push({ eaten_fraction:o.eatenFraction, weight:1 });
  });
  return stats;
}

function familyFit(candidate, household) {
  let score = Number(candidate.family_fit_score ?? 75);
  const stores = household.preferredStores || [];
  if (stores.length && !(candidate.store_tags || []).includes('Any')) {
    if ((candidate.store_tags || []).some(s => stores.includes(s))) score += 5;
    else score -= 8;
  }
  const weeklyBudget = Number(household.weeklyBudget);
  const dailyBudget = Number.isFinite(weeklyBudget) && weeklyBudget > 0 ? weeklyBudget / 5 : 0;
  if (dailyBudget > 0) {
    if ((candidate.estimated_cost || 0) <= dailyBudget) score += 5;
    else score -= Math.min(20, ((candidate.estimated_cost - dailyBudget) / Math.max(1,dailyBudget)) * 25);
  }
  return Math.max(0,Math.min(100,Math.round(score)));
}

export function candidatesForHousehold(household) {
  const rawMaxPrep=household.maxPrepMinutes;
  const hasMaxPrep=rawMaxPrep!==null&&rawMaxPrep!==undefined&&rawMaxPrep!==''&&Number.isFinite(Number(rawMaxPrep));
  const maxPrep=hasMaxPrep?Number(rawMaxPrep):null;

  return lunchCandidates.map(c => {
    let practicality = Number(c.practicality_score ?? 75);
    const prep = Number(c.prep_minutes ?? 10);
    if (hasMaxPrep) {
      if (prep > maxPrep) practicality -= Math.min(35, (prep - maxPrep) * 4);
      else practicality += Math.min(5, maxPrep - prep);
    }
    return {
      ...c,
      family_fit_score: familyFit(c, household),
      practicality_score: Math.max(0, Math.min(100, Math.round(practicality))),
    };
  });
}

export function generateChildWeek({ child, foodSeeds, outcomes, household, existingWeek }) {
  const stats = buildChildStats(child.id, foodSeeds, outcomes);
  const candidates = candidatesForHousehold(household);
  const lockedByDay = {};
  if (existingWeek?.days) {
    DAYS.forEach(day => {
      if (existingWeek.days[day]?.locked && existingWeek.days[day]?.result?.lunch) {
        lockedByDay[day] = existingWeek.days[day].result.lunch;
      }
    });
  }
  const recentFoodIds = outcomes
    .filter(o => o.childId === child.id)
    .slice(-24)
    .map(o => o.foodId);
  return generateWeek({ candidates, child, childFoodStats:stats, recentFoodIds, lockedByDay });
}

export function resultToWeek(engineResult, oldWeek = null) {
  const days = {};
  DAYS.forEach(day => {
    const prior = oldWeek?.days?.[day];
    days[day] = {
      locked: Boolean(prior?.locked),
      itemLocks: prior?.itemLocks || {},
      result: engineResult.plan[day],
    };
  });
  return { days, summary:engineResult.weekSummary, generatedAt:new Date().toISOString() };
}

function weekStateBefore(week, targetDay) {
  const selectedItems=[];
  const foodCounts={};
  for (const day of DAYS) {
    if (day === targetDay) break;
    const lunch = week.days?.[day]?.result?.lunch;
    if (!lunch) continue;
    lunch.items.forEach(item => {
      foodCounts[item.food_id]=(foodCounts[item.food_id]||0)+1;
      selectedItems.push({food_id:item.food_id,role:item.role});
    });
  }
  return { selectedItems, foodCounts, mains:new Set(selectedItems.filter(x=>x.role==='main').map(x=>x.food_id)) };
}

export function swapItem({ week, day, role, child, foodSeeds, outcomes, household }) {
  const dayState = week.days[day];
  const current = dayState?.result?.lunch;
  if (!current) return week;
  if (dayState.itemLocks?.[role]) return week;

  const currentItem = current.items.find(i=>i.role===role);
  const pool = [];
  candidatesForHousehold(household).forEach(c => c.items.filter(i=>i.role===role).forEach(i=>{
    if (i.food_id !== currentItem?.food_id && !pool.some(p=>p.food_id===i.food_id)) pool.push(i);
  }));

  const stats=buildChildStats(child.id,foodSeeds,outcomes);
  const ws=weekStateBefore(week,day);
  const alternatives=pool.map(item=>{
    const modified={...current,id:`${current.id}-swap-${role}-${item.food_id}`,name:`${current.name} (swap)`,items:current.items.map(i=>i.role===role?item:i)};
    return scoreLunch(modified,{child,childFoodStats:stats,weekState:ws,recentFoodIds:[]});
  }).filter(x=>x.eligible).sort((a,b)=>b.totalScore-a.totalScore);
  if (!alternatives.length) return week;

  const next=structuredClone(week);
  next.days[day].result=alternatives[0];
  next.days[day].result.lunch.items=next.days[day].result.lunch.items.map(i=>({...i,was_parent_swap:i.role===role || i.was_parent_swap}));
  return next;
}

export function groceryListFromWeek(week) {
  const map=new Map();
  DAYS.forEach(day=>{
    const lunch=week?.days?.[day]?.result?.lunch;
    (lunch?.items||[]).forEach(item=>{
      const key=item.food_id;
      const existing=map.get(key)||{foodId:key,name:item.name,role:item.role,count:0,days:[]};
      existing.count+=1;
      existing.days.push(day.slice(0,3));
      map.set(key,existing);
    });
  });
  return [...map.values()].sort((a,b)=>a.role.localeCompare(b.role)||a.name.localeCompare(b.name));
}
