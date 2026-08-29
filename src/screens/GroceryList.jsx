import { useMemo, useState } from 'react';
import { Check, ShoppingBasket } from 'lucide-react';
import PrimaryButton from '../components/PrimaryButton.jsx';
import { groceryListFromWeek } from '../lib/planService.js';
import { upcomingMondayISO } from '../lib/week.js';
import { track } from '../lib/repository.js';

const labels={main:'Mains',veg:'Vegetables',fruit:'Fruit',other:'Sides & extras'};
export default function GroceryList({state,onNext}){
  const child=state.children.find(c=>c.id===state.activeChildId)||state.children[0];
  const weekStart=state.ui.currentWeekStart||upcomingMondayISO();
  const key=`${child.id}:${weekStart}`;
  const list=useMemo(()=>groceryListFromWeek(state.weeks[key]),[state.weeks,key]);
  const [checked,setChecked]=useState({});
  const groups=Object.groupBy?Object.groupBy(list,x=>x.role):list.reduce((a,x)=>((a[x.role]??=[]).push(x),a),{});
  return <section>
    <div className="eyebrow">Step 5</div><h1>One grocery list for the week</h1><p className="lede">Alpha quantities are pack-frequency notes, not recipe-level shopping quantities yet.</p>
    <div className="grocery-card"><div className="grocery-title"><ShoppingBasket size={20}/><div><strong>{list.length} foods</strong><span>for {child.nickname}'s school week</span></div></div>
      {Object.entries(groups).map(([role,items])=><div className="grocery-group" key={role}><h3>{labels[role]||role}</h3>{items.map(item=><button key={item.foodId} className={`grocery-row ${checked[item.foodId]?'checked':''}`} onClick={()=>setChecked(c=>({...c,[item.foodId]:!c[item.foodId]}))}><span className="check-box">{checked[item.foodId]&&<Check size={14}/>}</span><span><strong>{item.name}</strong><small>Pack {item.count}× · {item.days.join(', ')}</small></span></button>)}</div>)}
    </div>
    <div className="planner-footer"><span>Store pricing and retailer integrations are intentionally out of Gate A.</span><PrimaryButton onClick={()=>{track('grocery_list_opened',{items:list.length});onNext();}}>Start the school week</PrimaryButton></div>
  </section>;
}
