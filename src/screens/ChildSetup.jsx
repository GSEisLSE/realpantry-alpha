import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import PrimaryButton from '../components/PrimaryButton.jsx';
import { track } from '../lib/repository.js';

const grades=['pre-k','k','1','2','3','4','5'];
const commonAllergens=['peanut','tree nut','milk','egg','soy','wheat','sesame'];
const stores=['Aldi','Costco','Target','Whole Foods','Fresh Thyme','Walmart'];

function newChild(){return {id:crypto.randomUUID(),nickname:'',grade_band:'k',allergens:[],blocked_tags:[],schoolNutFree:false};}

export default function ChildSetup({state,setState,onNext}){
  const [draftChildren,setDraftChildren]=useState(state.children.length?state.children:[newChild()]);
  const [household,setHousehold]=useState(state.household);
  const canContinue=useMemo(()=>draftChildren.length>0&&draftChildren.every(c=>c.nickname.trim()),[draftChildren]);

  function patchChild(id,patch){setDraftChildren(cs=>cs.map(c=>c.id===id?{...c,...patch}:c));}
  function toggleAllergen(id,a){setDraftChildren(cs=>cs.map(c=>c.id===id?{...c,allergens:c.allergens.includes(a)?c.allergens.filter(x=>x!==a):[...c.allergens,a]}:c));}
  function save(){
    const normalized=draftChildren.map(c=>({...c,blocked_tags:c.schoolNutFree?[...new Set([...(c.blocked_tags||[]),'school-banned-nuts'])]:(c.blocked_tags||[]).filter(x=>x!=='school-banned-nuts')}));
    setState(s=>({...s,children:normalized,activeChildId:s.activeChildId||normalized[0].id,household}));
    track('child_profile_completed',{children:normalized.length});
    onNext();
  }
  return <section>
    <div className="eyebrow">Step 1</div><h1>Set up your lunch planner</h1>
    <p className="lede">Only collect what changes a recommendation. No child account, school name, birthday or photo.</p>
    <div className="stack gap-lg">
      {draftChildren.map((child,index)=><div className="card" key={child.id}>
        <div className="card-head"><div><span className="mini-label">Child {index+1}</span><h2>{child.nickname||'Lunch profile'}</h2></div>{draftChildren.length>1&&<button className="icon-btn" onClick={()=>setDraftChildren(x=>x.filter(c=>c.id!==child.id))}><Trash2 size={17}/></button>}</div>
        <div className="form-grid">
          <label><span>Nickname</span><input value={child.nickname} placeholder="e.g. Sam" onChange={e=>patchChild(child.id,{nickname:e.target.value})}/></label>
          <label><span>Grade</span><select value={child.grade_band} onChange={e=>patchChild(child.id,{grade_band:e.target.value})}>{grades.map(g=><option key={g}>{g}</option>)}</select></label>
        </div>
        <div className="field-block"><span className="field-title">Allergies / hard restrictions</span><div className="chips">{commonAllergens.map(a=><button type="button" key={a} className={`chip ${child.allergens.includes(a)?'selected':''}`} onClick={()=>toggleAllergen(child.id,a)}>{a}</button>)}</div></div>
        <label className="check-row"><input type="checkbox" checked={child.schoolNutFree} onChange={e=>patchChild(child.id,{schoolNutFree:e.target.checked})}/><span>School/classroom is nut-free</span></label>
      </div>)}
      {draftChildren.length<2&&<button className="add-link" onClick={()=>setDraftChildren(c=>[...c,newChild()])}><Plus size={17}/> Add second child</button>}
      <div className="card">
        <span className="mini-label">Household constraints</span><h2>Keep the plan realistic</h2>
        <div className="form-grid">
          <label><span>Weekly lunch budget</span><div className="input-prefix"><b>$</b><input type="number" min="10" step="5" value={household.weeklyBudget} onChange={e=>setHousehold({...household,weeklyBudget:Number(e.target.value)})}/></div></label>
          <label><span>Max weekday prep</span><select value={household.maxPrepMinutes} onChange={e=>setHousehold({...household,maxPrepMinutes:Number(e.target.value)})}><option value="5">5 min</option><option value="10">10 min</option><option value="15">15 min</option><option value="20">20 min</option></select></label>
          <label><span>Typical lunch planning / week</span><div className="input-prefix"><b>min</b><input type="number" min="0" step="5" value={household.baselinePlanningMinutes??30} onChange={e=>setHousehold({...household,baselinePlanningMinutes:Number(e.target.value)})}/></div></label>
        </div>
        <div className="field-block"><span className="field-title">Stores you actually use</span><div className="chips">{stores.map(store=><button type="button" key={store} className={`chip ${household.preferredStores.includes(store)?'selected':''}`} onClick={()=>setHousehold(h=>({...h,preferredStores:h.preferredStores.includes(store)?h.preferredStores.filter(x=>x!==store):[...h.preferredStores,store]}))}>{store}</button>)}</div></div>
      </div>
      <PrimaryButton disabled={!canContinue} onClick={save}>Save & seed foods</PrimaryButton>
    </div>
  </section>;
}
