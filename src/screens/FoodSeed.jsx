import { useMemo, useState } from 'react';
import { seedFoods } from '../data/catalog.js';
import PrimaryButton from '../components/PrimaryButton.jsx';
import { track } from '../lib/repository.js';

const quickStatuses=[
  {id:'likes',label:'Yes'},
  {id:'okay',label:'Sometimes'},
  {id:'avoid',label:'No'},
];

function quickStartFoods(){
  const take=(category,n)=>seedFoods.filter(f=>f.category===category).slice(0,n);
  const selected=[...take('main',6),...take('veg',2),...take('fruit',2),...take('other',2)];
  return selected.filter((food,index)=>selected.findIndex(x=>x.id===food.id)===index);
}

export default function FoodSeed({state,setState,onNext}){
  const [showAll,setShowAll]=useState(false);
  const child=state.children.find(c=>c.id===state.activeChildId)||state.children[0];
  const seeds=state.foodSeeds[child?.id]||{};
  const quickFoods=useMemo(()=>quickStartFoods(),[]);
  const visibleFoods=showAll?seedFoods:quickFoods;

  function setFood(foodId,status){
    setState(s=>{
      const current={...(s.foodSeeds[child.id]||{})};
      if(current[foodId]===status) delete current[foodId];
      else current[foodId]=status;
      return {...s,foodSeeds:{...s.foodSeeds,[child.id]:current}};
    });
  }

  const answered=Object.keys(seeds).length;
  const acceptedStatuses=new Set(['loves','likes','okay']);
  const acceptedMains=seedFoods.filter(f=>f.category==='main'&&acceptedStatuses.has(seeds[f.id])).length;
  const canGenerate=answered>=8&&acceptedMains>=2;

  function continueNext(){
    track('seed_foods_completed',{childId:child.id,answered,acceptedMains});
    onNext();
  }

  return <section>
    <div className="eyebrow">Step 2</div><h1>What already works for {child?.nickname}?</h1>
    <p className="lede">Quick start only. Tap Yes, Sometimes or No for foods you already know. Skip anything you are unsure about.</p>
    <div className="seed-progress"><strong>{Math.min(answered,8)}</strong> of 8 needed <span>{canGenerate?`${acceptedMains} workable mains · ready to plan`:'Include at least 2 mains that are Yes or Sometimes.'}</span></div>
    <div className="seed-list">
      {visibleFoods.map(food=><div className="seed-row" key={food.id}>
        <div><strong>{food.name}</strong><span>{{main:'Main',veg:'Vegetable',fruit:'Fruit',other:'Extra'}[food.category]||food.category}</span></div>
        <div className="segmented" style={{gridTemplateColumns:'repeat(3,1fr)'}}>{quickStatuses.map(opt=><button key={opt.id} className={seeds[food.id]===opt.id?'selected':''} onClick={()=>setFood(food.id,opt.id)}>{opt.label}</button>)}</div>
      </div>)}
    </div>
    {!showAll&&<button type="button" className="add-link" style={{marginTop:12}} onClick={()=>setShowAll(true)}>Show more foods (optional)</button>}
    {showAll&&<button type="button" className="add-link" style={{marginTop:12}} onClick={()=>setShowAll(false)}>Back to quick start</button>}
    <div className="sticky-actions"><PrimaryButton disabled={!canGenerate} onClick={continueNext}>Plan the week</PrimaryButton></div>
  </section>;
}
