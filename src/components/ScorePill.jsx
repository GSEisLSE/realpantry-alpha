export default function ScorePill({label,value}){
  return <div className="score-pill"><span>{label}</span><strong>{value ?? '—'}</strong></div>;
}
