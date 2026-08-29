import { useMemo, useState } from 'react';
import { Lock, Unlock, RefreshCw, ShoppingBasket, Sparkles } from 'lucide-react';
import PrimaryButton from '../components/PrimaryButton.jsx';
import ScorePill from '../components/ScorePill.jsx';
import { DAYS, displayWeek, upcomingMondayISO } from '../lib/week.js';
import { generateChildWeek, resultToWeek, swapItem } from '../lib/planService.js';
import { track } from '../lib/repository.js';

const roles=['main','veg','fruit','other'];
export default function LockSwap({state,setState,onNext}){
  const child=state.children.find(c=>c.id===state.activeChildId)||state.children[0];
  const [weekStart]=useState(()=>state.ui.currentWeekStart||upcomingMondayISO());
  const key=`${child.id}:${weekStart}`;
  const week=state.weeks[key];
  const [busy,setBusy]=useState(false);

  function generate(){
    setBusy(true);
    const result=generateChildWeek({child,foodSeeds:state.foodSeeds,outcomes:state.outcomes,household:state.household,existingWeek:week});
    const nextWeek={...resultToWeek(result,week),childId:child.id,weekStart};
    setState(s=>({...s,weeks:{...s.weeks,[key]:nextWeek}}));
    track(week?'week_regenerated':'week_generated',{childId:child.id,weekStart});
    setTimeout(()=>setBusy(false),180);
  }
  function toggleDay(day){setState(s=>{const w=structuredClone(s.weeks[key]);w.days[day].locked=!w.days[day].locked;return {...s,weeks:{...s.weeks,[key]:w}}});track('day_locked',{day});}
  function toggleItem(day,role){setState(s=>{const w=structuredClone(s.weeks[key]);w.days[day].itemLocks={...(w.days[day].itemLocks||{}),[role]:!w.days[day].itemLocks?.[role]};return {...s,weeks:{...s.weeks,[key]:w}}});}
  function swap(day,role){setState(s=>({...s,weeks:{...s.weeks,[key]:swapItem({week:s.weeks[key],day,role,child,foodSeeds:s.foodSeeds,outcomes:s.outcomes,household:s.household})}}));track('item_swapped',{day,role});}
  const summary=week?.summary;
  return <section>
    <div className="planner-head"><div><div className="eyebrow">Step 4 · Week of {displayWeek(weekStart)}</div><h1>Lock what works. Swap what doesn't.</h1><p className="lede">Keep the good parts, repair only what you want, then freeze the week.</p></div><PrimaryButton onClick={generate}>{busy?<><RefreshCw size={17} className="spin"/> Building…</>:<><Sparkles size={17}/>{week?'Regenerate unlocked':'Generate week'}</>}</PrimaryButton></div>
    {!week&&<div className="empty-state"><Sparkles size={28}/><h2>Your first week is ready to be built.</h2><p>Hard restrictions are filtered before a lunch is ever scored.</p></div>}
    {week&&<>
      <div className="week-summary"><ScorePill label="Eat confidence" value={`${summary?.averageAcceptance??'—'}%`}/><ScorePill label="Nutrition" value={summary?.averageNutrition}/><ScorePill label="Variety" value={summary?.averageVariety}/><ScorePill label="Unique foods" value={summary?.uniqueFoods}/></div>
      <div className="week-grid">{DAYS.map(day=>{const d=week.days[day];const r=d?.result;return <article className="day-card" key={day}>
        <div className="day-card-head"><div><span>{day}</span><strong>{r?.eligible?r.totalScore:'—'}</strong></div><button className={`icon-btn ${d?.locked?'locked':''}`} onClick={()=>toggleDay(day)} title="Lock day">{d?.locked?<Lock size={16}/>:<Unlock size={16}/>}</button></div>
        {!r?.eligible?<div className="warning">No eligible lunch: {r?.reason}</div>:<>
          <div className="score-strip"><span>Eat {r.subScores.acceptance}</span><span>Nutrition {r.subScores.nutrition}</span><span>Variety {r.subScores.variety}</span></div>
          <div className="items">{roles.map(role=>{const item=r.lunch.items.find(i=>i.role===role);if(!item)return null;const locked=d.itemLocks?.[role];return <div className="item-row" key={role}>
            <div><span className="role">{role}</span><strong>{item.name}</strong></div><div className="item-actions"><button className={locked?'tiny selected':'tiny'} onClick={()=>toggleItem(day,role)}>{locked?<Lock size={13}/>:<Unlock size={13}/>}</button><button className="tiny" disabled={locked||d.locked} onClick={()=>swap(day,role)}><RefreshCw size={13}/> swap</button></div>
          </div>})}</div>
          <div className="explain">{(r.explanation||[]).slice(0,3).map(x=><span key={x}>• {x}</span>)}</div>
        </>}
      </article>})}</div>
      <div className="planner-footer"><span>Lock anything you want to keep. Regenerate only replaces unlocked days.</span><PrimaryButton onClick={()=>{track('grocery_list_opened',{weekStart});onNext();}}><ShoppingBasket size={17}/> Build grocery list</PrimaryButton></div>
    </>}
  </section>;
}
