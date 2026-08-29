import { useState } from 'react';
import { Sparkles, RefreshCw, ArrowRight } from 'lucide-react';
import PrimaryButton from '../components/PrimaryButton.jsx';
import ScorePill from '../components/ScorePill.jsx';
import { DAYS, displayWeek, upcomingMondayISO } from '../lib/week.js';
import { generateChildWeek, resultToWeek } from '../lib/planService.js';
import { track } from '../lib/repository.js';
import { lunchCandidates } from '../data/catalog.js';

export default function PlanMyWeek({state,setState,onNext}){
  const child=state.children.find(c=>c.id===state.activeChildId)||state.children[0];
  const [weekStart]=useState(()=>state.ui.currentWeekStart||upcomingMondayISO());
  const key=`${child.id}:${weekStart}`;
  const week=state.weeks[key];
  const [busy,setBusy]=useState(false);
  function generate(){
    setBusy(true);
    const result=generateChildWeek({child,foodSeeds:state.foodSeeds,outcomes:state.outcomes,household:state.household,existingWeek:week});
    const next={...resultToWeek(result,week),childId:child.id,weekStart};
    setState(s=>({...s,weeks:{...s.weeks,[key]:next}}));
    track('week_generated',{childId:child.id,weekStart,source:'plan_screen'});
    setTimeout(()=>setBusy(false),160);
  }
  return <section>
    <div className="eyebrow">Step 3 · Week of {displayWeek(weekStart)}</div><h1>Plan my week</h1>
    <p className="lede">One action builds five school lunches. The alpha records how much you need to change afterward.</p>
    {!week?<div className="hero-generate"><div className="hero-icon"><Sparkles size={30}/></div><h2>Build {child.nickname}'s Monday–Friday lunches</h2><p>Using {Object.keys(state.foodSeeds[child.id]||{}).length} seeded foods, {lunchCandidates.length} alpha lunch patterns, hard restrictions, a ${state.household.weeklyBudget} weekly target, and {state.household.maxPrepMinutes}-minute prep limit.</p><PrimaryButton onClick={generate}>{busy?<><RefreshCw size={17} className="spin"/> Ranking lunches…</>:<><Sparkles size={17}/> Generate my week</>}</PrimaryButton></div>:
      <>
        <div className="week-summary"><ScorePill label="Eat confidence" value={`${week.summary?.averageAcceptance??'—'}%`}/><ScorePill label="Nutrition" value={week.summary?.averageNutrition}/><ScorePill label="Variety" value={week.summary?.averageVariety}/><ScorePill label="Unique foods" value={week.summary?.uniqueFoods}/></div>
        <div className="preview-week">{DAYS.map(day=>{const r=week.days[day]?.result;return <div className="preview-day" key={day}><strong>{day.slice(0,3)}</strong><div>{r?.lunch?.items?.map(i=><span key={i.food_id}>{i.name}</span>)||<span>No eligible lunch</span>}</div><b>{r?.totalScore||'—'}</b></div>})}</div>
        <div className="decision-card"><div><span className="mini-label">First-impression test</span><h2>Don't perfect it here.</h2><p>Next, lock what you like and swap only the weak spots. The amount of repair is part of the product test.</p></div><PrimaryButton onClick={onNext}>Review & edit <ArrowRight size={17}/></PrimaryButton></div>
      </>}
  </section>;
}
