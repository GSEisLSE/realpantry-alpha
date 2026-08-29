import { Check } from 'lucide-react';

export default function StepNav({steps,current,onStep}){
  return <div className="stepnav" aria-label="Alpha workflow">
    {steps.map((s,i)=><button key={s} className={`step ${i===current?'active':''} ${i<current?'done':''}`} onClick={()=>onStep(i)}>
      <span className="step-dot">{i<current?<Check size={13}/>:i+1}</span><span>{s}</span>
    </button>)}
  </div>;
}
