import { seedFoods, statusOptions } from '../data/catalog.js';
import PrimaryButton from '../components/PrimaryButton.jsx';
import { track } from '../lib/repository.js';

export default function FoodSeed({state,setState,onNext}){
  const child=state.children.find(c=>c.id===state.activeChildId)||state.children[0];
  const seeds=state.foodSeeds[child?.id]||{};
  function setFood(foodId,status){setState(s=>({...s,foodSeeds:{...s.foodSeeds,[child.id]:{...(s.foodSeeds[child.id]||{}),[foodId]:status}}}));}
  const answered=Object.keys(seeds).length;
  const acceptedStatuses=new Set(['loves','likes','okay']);
  const acceptedMains=seedFoods.filter(f=>f.category==='main'&&acceptedStatuses.has(seeds[f.id])).length;
  const canGenerate=answered>=8&&acceptedMains>=2;
  function continueNext(){track('seed_foods_completed',{childId:child.id,answered,acceptedMains});onNext();}
  return <section>
    <div className="eyebrow">Step 2</div><h1>What already works for {child?.nickname}?</h1>
    <p className="lede">This is only the starting prior. What actually comes home will matter more over time.</p>
    <div className="seed-progress"><strong>{answered}</strong> of {seedFoods.length} quick foods seeded <span>{canGenerate?`${acceptedMains} workable mains · ready to plan`:'Mark at least 8 foods, including 2 workable mains.'}</span></div>
    <div className="seed-list">
      {seedFoods.map(food=><div className="seed-row" key={food.id}>
        <div><strong>{food.name}</strong><span>{{main:'Main',veg:'Vegetable',fruit:'Fruit',other:'Extra'}[food.category]||food.category}</span></div>
        <div className="segmented">{statusOptions.map(opt=><button key={opt.id} className={seeds[food.id]===opt.id?'selected':''} onClick={()=>setFood(food.id,opt.id)}>{opt.short}</button>)}</div>
      </div>)}
    </div>
    <div className="sticky-actions"><PrimaryButton disabled={!canGenerate} onClick={continueNext}>Plan the week</PrimaryButton></div>
  </section>;
}
