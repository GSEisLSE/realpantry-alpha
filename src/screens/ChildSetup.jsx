import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import PrimaryButton from '../components/PrimaryButton.jsx';
import { track } from '../lib/repository.js';

const grades=['pre-k','k','1','2','3','4','5'];
const commonAllergens=['peanut','tree nut','milk','egg','soy','wheat','sesame'];
const stores=['Aldi','Costco','Target','Whole Foods','Fresh Thyme','Jewel-Osco','The Fresh Market',"Mariano's",'Walmart'];

function newChild(){return {id:crypto.randomUUID(),nickname:'',grade_band:'k',allergens:[],blocked_tags:[],schoolNutFree:false};}

export default function ChildSetup({state,setState,onNext}){
  const [draftChildren,setDraftChildren]=useState(state.children.length?state.children:[newChild()]);
  const [household,setHousehold]=useState(state.household);
  const canContinue=useMemo(()=>draftChildren.length>0&&draftChildren.every(c=>c.nickname.trim()),[draftChildren]);
  const preferredStores=household.preferredStores||[];

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
      {draftChildren.length<4&&<button className="add-link" onClick={()=>setDraftChildren(c=>[...c,newChild()])}><Plus size={17}/> Add another child</button>}
      <div className="card">
        <span className="mini-label">Household constraints</span><h2>Keep the plan realistic</h2>
        <p className="lede" style={{marginBottom:0}}>These are optional. Skip anything that is not a real household constraint.</p>
        <div className="form-grid">
          <div className="field-block">
            <span className="field-title">Weekly lunch budget</span>
            <div className="chips"><button type="button" className={`chip ${household.weeklyBudget==null?'selected':''}`} onClick={()=>setHousehold({...household,weeklyBudget:null})}>N/A / not sure</button></div>
            <div className="input-prefix" style={{marginTop:9}}><b>$</b><input type="number" min="0" step="5" placeholder="Optional" value={household.weeklyBudget??''} onChange={e=>setHousehold({...household,weeklyBudget:e.target.value===''?null:Number(e.target.value)})}/></div>
          </div>
          <div className="field-block">
            <span className="field-title">Max weekday prep</span>
            <select style={{marginTop:9}} value={household.maxPrepMinutes??''} onChange={e=>setHousehold({...household,maxPrepMinutes:e.target.value===''?null:Number(e.target.value)})}>
              <option value="">N/A / varies</option>
              <option value="10">10 min</option>
              <option value="20">20 min</option>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">60+ min</option>
            </select>
          </div>
        </div>
        <div className="field-block"><span className="field-title">Stores you actually use</span><div className="chips">{stores.map(store=><button type="button" key={store} className={`chip ${preferredStores.includes(store)?'selected':''}`} onClick={()=>setHousehold(h=>{const current=h.preferredStores||[];return {...h,preferredStores:current.includes(store)?current.filter(x=>x!==store):[...current,store]};})}>{store}</button>)}</div></div>
      </div>
      <PrimaryButton disabled={!canContinue} onClick={save}>Save & seed foods</PrimaryButton>
    </div>
  </section>;
}
