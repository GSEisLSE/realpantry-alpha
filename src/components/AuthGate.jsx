import { useState } from 'react';
import { Cloud, Mail } from 'lucide-react';
import { sendMagicLink } from '../lib/cloudRepository.js';

export default function AuthGate({ cloudConfigured }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setStatus('');
    try {
      await sendMagicLink(email.trim());
      setStatus('Check your email for the secure Real Pantry sign-in link.');
    } catch (err) {
      setStatus(err.message || 'Could not send sign-in link.');
    } finally {
      setBusy(false);
    }
  }

  if (!cloudConfigured) return (
    <div className="auth-card">
      <Cloud size={26}/>
      <h1>Cloud setup needed</h1>
      <p>This build is cloud-ready, but the Supabase environment variables have not been supplied.</p>
    </div>
  );

  return <div className="auth-card">
    <div className="brandmark"><Cloud size={20}/></div>
    <h1>Founder Household Alpha</h1>
    <p>Use a parent email. Children do not receive accounts.</p>
    <form onSubmit={submit}>
      <label>Parent email</label>
      <div className="auth-email"><Mail size={16}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></div>
      <button className="primary" disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
    </form>
    {status && <div className="auth-status">{status}</div>}
  </div>;
}
