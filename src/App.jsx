import { useEffect, useMemo, useRef, useState } from 'react';
import { Cloud, CloudOff, Leaf, LogOut, RotateCcw } from 'lucide-react';
import StepNav from './components/StepNav.jsx';
import AuthGate from './components/AuthGate.jsx';
import ChildSetup from './screens/ChildSetup.jsx';
import FoodSeed from './screens/FoodSeed.jsx';
import PlanMyWeek from './screens/PlanMyWeek.jsx';
import LockSwap from './screens/LockSwap.jsx';
import GroceryList from './screens/GroceryList.jsx';
import Feedback from './screens/Feedback.jsx';
import { emptyState, loadState, normalizeState, resetState, saveState, track } from './lib/repository.js';
import { cloudConfigured } from './lib/supabaseClient.js';
import { ensureHousehold, getSession, loadCloudState, onAuthChange, saveCloudState, signOut, trackCloudEvent } from './lib/cloudRepository.js';
import { nextWeekISO, upcomingMondayISO } from './lib/week.js';

const steps=['Child setup','Food seed','Plan my week','Lock / swap','Grocery list','What came back?'];

function hasMeaningfulLocalData(state){
  return Boolean(state?.children?.length || Object.keys(state?.weeks || {}).length || state?.outcomes?.length);
}

export default function App(){
  const [state,setState]=useState(()=>loadState());
  const [session,setSession]=useState(null);
  const [authReady,setAuthReady]=useState(!cloudConfigured);
  const [cloudStatus,setCloudStatus]=useState(cloudConfigured ? 'connecting' : 'local');
  const [cloudError,setCloudError]=useState('');
  const householdIdRef=useRef(null);
  const hydratedRef=useRef(false);
  const syncTimerRef=useRef(null);
  const step=Math.min(5,Math.max(0,state.ui?.step||0));

  useEffect(()=>{
    let live=true;
    if(!cloudConfigured){ hydratedRef.current=true; return; }
    getSession().then(s=>{ if(live){ setSession(s); setAuthReady(true); } }).catch(err=>{ if(live){ setCloudError(err.message); setCloudStatus('error'); setAuthReady(true); } });
    const unsub=onAuthChange(s=>{ if(live){ setSession(s); setAuthReady(true); } });
    return ()=>{ live=false; unsub(); };
  },[]);

  useEffect(()=>{
    if(!cloudConfigured || !session?.user){ householdIdRef.current=null; hydratedRef.current=false; return; }
    let cancelled=false;
    (async()=>{
      try{
        setCloudStatus('connecting'); setCloudError('');
        const householdId=await ensureHousehold(session.user);
        if(cancelled)return;
        householdIdRef.current=householdId;
        const cloud=await loadCloudState(householdId);
        if(cancelled)return;
        const local=loadState();
        if(cloud?.state && Object.keys(cloud.state).length){
          const hydrated=normalizeState({...cloud.state,cloud:{...(cloud.state.cloud||{}),householdId,lastSyncedAt:cloud.updated_at}});
          setState(hydrated); saveState(hydrated);
        }else{
          const initial=normalizeState({...local,cloud:{...(local.cloud||{}),householdId}});
          setState(initial); saveState(initial);
          await saveCloudState(householdId,initial);
        }
        hydratedRef.current=true;
        setCloudStatus('synced');
      }catch(err){
        setCloudError(err.message||'Cloud sync failed.');
        setCloudStatus('error');
      }
    })();
    return()=>{cancelled=true;};
  },[session?.user?.id]);

  useEffect(()=>{
    saveState(state);
    if(!cloudConfigured || !session?.user || !householdIdRef.current || !hydratedRef.current)return;
    clearTimeout(syncTimerRef.current);
    setCloudStatus('saving');
    syncTimerRef.current=setTimeout(async()=>{
      try{
        const saved=await saveCloudState(householdIdRef.current,state);
        saveState(saved);
        setCloudStatus('synced');
      }catch(err){ setCloudError(err.message||'Cloud save failed.'); setCloudStatus('error'); }
    },700);
    return()=>clearTimeout(syncTimerRef.current);
  },[state,session?.user?.id]);

  useEffect(()=>{
    function onAlphaEvent(e){
      if(!householdIdRef.current || !session?.user)return;
      const activeChild=state.activeChildId || null;
      trackCloudEvent(householdIdRef.current,e.detail,activeChild,null).catch(()=>{});
    }
    window.addEventListener('realpantry:alpha-event',onAlphaEvent);
    return()=>window.removeEventListener('realpantry:alpha-event',onAlphaEvent);
  },[session?.user?.id,state.activeChildId]);

  useEffect(()=>{ if(!state.ui?.currentWeekStart){setState(s=>({...s,ui:{...s.ui,currentWeekStart:upcomingMondayISO()}}));}},[]);
  const canNavigate=useMemo(()=>Boolean(state.children?.length),[state.children]);
  function setStep(n){ if(n>0&&!canNavigate)return; setState(s=>({...s,ui:{...s.ui,step:n}})); }
  function next(){setStep(Math.min(5,step+1));}
  function anotherWeek(){
    const current=state.ui.currentWeekStart||upcomingMondayISO();
    setState(s=>({...s,ui:{...s.ui,currentWeekStart:nextWeekISO(current),step:2}}));
  }
  function hardReset(){
    if(!confirm('Reset this household alpha state? This clears the current local workflow and will sync the empty state to cloud.'))return;
    resetState();
    const blank=emptyState();
    blank.cloud={householdId:householdIdRef.current,lastSyncedAt:null};
    setState(blank); track('alpha_reset');
  }
  async function doSignOut(){ await signOut(); setSession(null); householdIdRef.current=null; }

  if(!authReady) return <div className="app-shell"><div className="auth-card"><Cloud size={26}/><h1>Opening Real Pantry…</h1><p>Restoring the parent session.</p></div></div>;
  if(cloudConfigured && !session) return <div className="app-shell"><AuthGate cloudConfigured={cloudConfigured}/></div>;

  const screenProps={state,setState,onNext:next};
  const cloudLabel=cloudStatus==='synced'?'Saved':cloudStatus==='saving'?'Saving…':cloudStatus==='error'?'Cloud issue':cloudStatus==='local'?'Local only':'Connecting…';
  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brandmark"><Leaf size={18}/></span><div><strong>Real Pantry</strong><span>Founder Household Alpha</span></div></div><div className="header-actions"><span className={`cloud-badge ${cloudStatus}`}>{cloudStatus==='error'?<CloudOff size={13}/>:<Cloud size={13}/>} {cloudLabel}</span><button className="reset" onClick={hardReset}><RotateCcw size={14}/> Reset</button>{cloudConfigured&&<button className="reset" onClick={doSignOut}><LogOut size={14}/> Sign out</button>}</div></header>
    {cloudError&&<div className="cloud-warning">Cloud sync issue: {cloudError}. Local data remains on this device.</div>}
    <StepNav steps={steps} current={step} onStep={setStep}/>
    <main>
      {step===0&&<ChildSetup {...screenProps}/>} 
      {step===1&&<FoodSeed {...screenProps}/>} 
      {step===2&&<PlanMyWeek {...screenProps}/>} 
      {step===3&&<LockSwap {...screenProps}/>} 
      {step===4&&<GroceryList {...screenProps}/>} 
      {step===5&&<Feedback {...screenProps} onRestart={anotherWeek}/>} 
    </main>
    <footer><span>Gate A: parent-only account · nickname-only child profile · cloud-backed weekly history</span><b>v0.3 · founder household</b></footer>
  </div>;
}
