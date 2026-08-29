import { useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import PrimaryButton from '../components/PrimaryButton.jsx';
import { DAYS, eatenFraction, nextWeekISO, upcomingMondayISO } from '../lib/week.js';
import { track } from '../lib/repository.js';

const outcomes=[['all','All'],['most','Most'],['half','Half'],['little','Little'],['none','None']];
export default function Feedback({state,setState,onRestart}){
  const child=state.children.find(c=>c.id===state.activeChildId)||state.children[0];
  const weekStart=state.ui.currentWeekStart||upcomingMondayISO();
  const key=`${child.id}:${weekStart}`;
  const week=state.weeks[key];
  const [day,setDay]=useState('Monday');
  const existing=useMemo(()=>Object.fromEntries(state.outcomes.filter(o=>o.childId===child.id&&o.weekStart===weekStart&&o.day===day).map(o=>[o.foodId,o.outcome])),[state.outcomes,child.id,weekStart,day]);
  const [draft,setDraft]=useState(existing);
  const items=week?.days?.[day]?.result?.lunch?.items||[];

  function save(){
    const newRows=items.filter(i=>draft[i.food_id]).map(i=>({id:crypto.randomUUID(),childId:child.id,weekStart,day,foodId:i.food_id,outcome:draft[i.food_id],eatenFraction:eatenFraction(draft[i.food_id]),occurredOn:new Date().toISOString().slice(0,10)}));
    setState(s=>({...s,outcomes:[...s.outcomes.filter(o=>!(o.childId===child.id&&o.weekStart===weekStart&&o.day===day)),...newRows]}));
    track('outcome_logged',{day,count:newRows.length});
    const idx=DAYS.indexOf(day); if(idx<DAYS.length-1){setDay(DAYS[idx+1]);setDraft({});}
  }
  function nextWeek(){track('second_week_generated_intent',{childId:child.id,nextWeek:nextWeekISO(weekStart)});onRestart();}
  return <section>
    <div className="eyebrow">Step 6</div><h1>What came back?</h1><p className="lede">The fastest important screen in the product. Four taps should be enough to teach next week.</p>
    <div className="day-tabs">{DAYS.map(d=><button key={d} className={d===day?'active':''} onClick={()=>{setDay(d);setDraft({});}}>{d.slice(0,3)}</button>)}</div>
    <div className="feedback-card">
      <div className="feedback-head"><div><span>{day}</span><strong>How much was eaten?</strong></div><small>Tap one per item</small></div>
      {items.map(item=><div className="feedback-row" key={item.food_id}><div><span className="role">{item.role}</span><strong>{item.name}</strong></div><div className="outcome-buttons">{outcomes.map(([id,label])=><button key={id} className={draft[item.food_id]===id?'selected':''} onClick={()=>setDraft(d=>({...d,[item.food_id]:id}))}>{label}</button>)}</div></div>)}
      <PrimaryButton disabled={!items.length||Object.keys(draft).length===0} onClick={save}><CheckCircle2 size={17}/> Save {day}</PrimaryButton>
    </div>
    <div className="learning-card"><div><span className="mini-label">The loop</span><h2>Next week now starts smarter.</h2><p>{state.outcomes.filter(o=>o.childId===child.id).length} food outcomes are currently in {child.nickname}'s history. Those observations update acceptance estimates; they do not override allergy or nutrition gates.</p></div><PrimaryButton secondary onClick={nextWeek}><RotateCcw size={17}/> Plan another week</PrimaryButton></div>
  </section>;
}
