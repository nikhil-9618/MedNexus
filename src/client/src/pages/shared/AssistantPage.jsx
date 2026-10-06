import { useEffect, useRef, useState } from 'react';
import { SendHorizonal, Sparkles, ShieldAlert } from 'lucide-react';
import { assistantService } from '../../services/assistantService.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { homeForRole } from '../../routes/paths.js';
import { Link } from 'react-router-dom';

export default function AssistantPage() {
  const { user } = useAuth();
  const { data: meta } = useAsync(() => assistantService.meta(), []);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    setMessages([
      { from: 'bot', text: "Hi! I'm the MedNexus assistant. I can help you navigate the app — booking, records, appointments and more." },
    ]);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text) {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput('');
    setMessages((m) => [...m, { from: 'user', text: message }]);
    setBusy(true);
    try {
      const res = await assistantService.ask(message);
      setMessages((m) => [...m, { from: 'bot', text: res.data.reply, link: res.data.link }]);
    } catch {
      setMessages((m) => [...m, { from: 'bot', text: 'Sorry — I could not process that. Please try again.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-11rem)] max-w-3xl flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900">MedNexus Assistant</h2>
          <p className="mt-0.5 text-sm text-slate-500">Navigation and app guidance — instantly, offline-safe.</p>
        </div>
        <span className="badge bg-violet-50 text-violet-700 ring-1 ring-violet-200"><Sparkles className="h-3.5 w-3.5" /> {meta?.data ? 'Rule-based' : 'Rule-based'}</span>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        {meta?.disclaimer || 'AI assistant provides application guidance only and does not provide medical diagnosis or treatment advice.'}
      </div>

      {/* Messages */}
      <div className="card mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                m.from === 'user' ? 'bg-brand-600 text-white' : 'bg-slate-50 text-slate-700 ring-1 ring-slate-100'
              }`}>
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.link && (
                  <Link to={m.link.to} className="mt-2 inline-block rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700">
                    {m.link.label} →
                  </Link>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="flex justify-start"><div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-100">Thinking…</div></div>}
          <div ref={endRef} />
        </div>

        {/* Suggestions */}
        <div className="border-t border-slate-100 px-4 pt-3">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(meta?.suggestions || []).map((s) => (
              <button key={s} onClick={() => send(s)} className="shrink-0 rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-brand-50 hover:text-brand-700">
                {s}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2 border-t border-slate-100 p-4">
          <input
            className="input"
            placeholder="Ask about appointments, records, navigation…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
          />
          <button type="submit" className="btn-primary px-3.5 py-2.5" disabled={busy || !input.trim()} aria-label="Send">
            <SendHorizonal className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
