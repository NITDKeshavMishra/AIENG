import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowUp, BriefcaseBusiness, Check, ChevronRight, Copy, Menu, MessageSquare, Moon, Plus, Sparkles, Square, Sun, Trash2, X } from 'lucide-react';
import { streamChat } from './api';

const STORE = 'candidate-chat-v1';
const suggestions = [
  ['Meet the candidate', 'Tell me about this candidate and his professional experience.'],
  ['Explore projects', 'Explain the candidate’s projects and the technologies used.'],
  ['Technical strengths', 'What are the candidate’s strongest documented technical skills?'],
  ['Interview preparation', 'Generate five technical interview questions based on the resume.'],
];
function readSaved() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE) || '{}');
    return {
      messages: Array.isArray(data.messages) ? data.messages.filter(m => m && typeof m.id === 'string' && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string').slice(-100) : [],
      jd: typeof data.jd === 'string' ? data.jd : '',
    };
  } catch { return { messages: [], jd: '' }; }
}

export default function App() {
  const [saved] = useState(readSaved);
  const [messages, setMessages] = useState(saved.messages);
  const [jd, setJd] = useState(saved.jd);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [jdOpen, setJdOpen] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('candidate-theme') !== 'light'; } catch { return true; } });
  const [copied, setCopied] = useState(null);
  const controller = useRef(null);
  const active = useRef(false);
  const scroll = useRef(null);
  const stickToBottom = useRef(true);
  const inputRef = useRef(null);
  const copyTimer = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem('candidate-theme', dark ? 'dark' : 'light'); } catch { /* Storage optional. */ }
  }, [dark]);
  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify({ messages, jd })); } catch { /* Storage optional. */ }
  }, [messages, jd]);
  useEffect(() => {
    if (stickToBottom.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages, busy, error, notice]);
  useEffect(() => {
    const node = inputRef.current;
    if (node) { node.style.height = 'auto'; node.style.height = `${Math.min(node.scrollHeight, 160)}px`; }
  }, [input]);
  useEffect(() => () => { controller.current?.abort(); clearTimeout(copyTimer.current); }, []);

  function patch(id, changes) {
    setMessages(previous => previous.map(m => m.id === id ? { ...m, ...changes } : m));
  }
  async function send(text = input) {
    const question = text.trim();
    if (!question || active.current) return;
    if (question.length > 4000) { setError('Please keep your question under 4,000 characters.'); return; }
    active.current = true;
    setBusy(true); setError(''); setNotice(''); setInput(''); setSidebar(false);
    stickToBottom.current = true;
    const user = { id: crypto.randomUUID(), role: 'user', content: question, status: 'complete' };
    const answerId = crypto.randomUUID();
    const history = messages.filter(m => m.content.trim() && m.status === 'complete')
      .slice(-20).map(({ role, content }) => ({ role, content: content.slice(0, 8000) }));
    setMessages(previous => [...previous, user, { id: answerId, role: 'assistant', content: '', status: 'pending' }]);
    const abort = new AbortController();
    controller.current = abort;
    let answer = '';
    try {
      const reason = await streamChat({ question, history, job_description: jd.trim() || null }, abort.signal, token => {
        answer += token;
        patch(answerId, { content: answer });
      });
      patch(answerId, { status: reason === 'length' ? 'incomplete' : 'complete' });
      if (reason === 'length') setNotice('The answer reached its output limit and may be incomplete.');
    } catch (err) {
      patch(answerId, { status: 'incomplete' });
      if (err.name === 'AbortError') setNotice('Generation stopped. Partial answers are not sent as conversation history.');
      else setError(err.message === 'Failed to fetch' ? 'Cannot reach the backend. Check that FastAPI is running and CORS allows this frontend URL.' : err.message);
    } finally {
      controller.current = null;
      active.current = false;
      setBusy(false);
      inputRef.current?.focus();
    }
  }
  function clearChat() {
    if (active.current) return;
    if (messages.length && !window.confirm('Clear this conversation?')) return;
    setMessages([]); setError(''); setNotice(''); setSidebar(false);
  }
  async function copyMessage(message) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(message.id);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 1800);
    } catch { setError('Copy failed. Select the response text and copy it manually.'); }
  }

  return (
    <div className="app-shell">
      {sidebar && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setSidebar(false)} />}
      <aside className={`sidebar ${sidebar ? 'open' : ''}`}>
        <div className="brand"><div className="brand-icon"><Sparkles size={19} /></div><span>Candidate AI</span><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setSidebar(false)}><X size={18}/></button></div>
        <button className="new-chat" onClick={clearChat} disabled={busy}><Plus size={18}/> New chat</button>
        <div className="section-label">YOUR WORKSPACE</div>
        <button className="nav-item selected" onClick={() => setSidebar(false)}><MessageSquare size={17}/> Candidate conversation</button>
        <button className="nav-item" onClick={() => { setJdOpen(true); setSidebar(false); }}><BriefcaseBusiness size={17}/> Job description {jd.trim() && <span className="dot"/>}</button>
        <div className="sidebar-note"><Sparkles size={18}/><p>A resume you can talk to.</p><span>Explore experience, projects, and job fit through conversation.</span></div>
        <div className="sidebar-bottom"><button className="nav-item" onClick={() => setDark(v => !v)}>{dark ? <Sun size={17}/> : <Moon size={17}/>} {dark ? 'Light appearance' : 'Dark appearance'}</button><button className="nav-item" disabled={busy} onClick={clearChat}><Trash2 size={17}/> Clear conversation</button><div className="profile"><div className="avatar">KM</div><div>Keshav Mishra<small>Candidate portfolio</small></div><span className="profile-dot"/></div></div>
      </aside>
      <main className="main">
        <header className="topbar"><div className="header-left"><button className="icon-button mobile-toggle" aria-label="Open navigation" onClick={() => setSidebar(true)}><Menu size={20}/></button><span>Candidate assistant</span><span className="header-tag">Resume-grounded</span></div><button className={`jd-button ${jd.trim() ? 'attached' : ''}`} onClick={() => setJdOpen(true)}><BriefcaseBusiness size={16}/><span>{jd.trim() ? 'JD attached' : 'Match a job'}</span></button></header>
        <div className="conversation" ref={scroll} onScroll={() => { const node = scroll.current; stickToBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 100; }}>
          {!messages.length ? <section className="welcome"><div className="welcome-symbol"><Sparkles size={30}/></div><div className="eyebrow">MEET YOUR NEXT TEAM MEMBER</div><h1>Hi, I’m Keshav’s<br/><span>AI representative.</span></h1><p>Ask about my candidate’s experience, explore his projects,<br className="desktop-break"/> or see how his skills align with your next role.</p><div className="suggestions">{suggestions.map(([title, question]) => <button key={title} onClick={() => send(question)}><span>{title}</span><ChevronRight size={17}/><small>{question}</small></button>)}</div></section> : <div className="message-list">{messages.map(message => <article key={message.id} className={`message ${message.role}`}><div className="message-avatar">{message.role === 'assistant' ? <Sparkles size={18}/> : 'You'}</div><div className="message-body"><div className="message-author">{message.role === 'assistant' ? 'Candidate AI' : 'You'}</div>{message.content ? <div className="markdown"><ReactMarkdown>{message.content}</ReactMarkdown></div> : message.status === 'pending' && busy ? <div className="typing" aria-label="Generating response"><i/><i/><i/></div> : <p className="muted">No response generated.</p>}{message.role === 'assistant' && message.content && <div className="response-tools"><button className="copy-button" onClick={() => copyMessage(message)} aria-label="Copy response">{copied === message.id ? <Check size={14}/> : <Copy size={14}/>} {copied === message.id ? 'Copied' : 'Copy'}</button>{message.status === 'incomplete' && <small>Incomplete response</small>}</div>}</div></article>)}</div>}
          <div className="feedback" role="status">{error && <div className="error">{error}<button aria-label="Dismiss error" onClick={() => setError('')}><X size={15}/></button></div>}{notice && <div className="notice">{notice}</div>}</div>
        </div>
        <footer className="composer-area"><form className="composer" onSubmit={event => { event.preventDefault(); send(); }}><textarea ref={inputRef} rows={1} value={input} maxLength={4000} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} placeholder="Ask anything about the candidate…" aria-label="Your question"/><div className="composer-bottom"><button type="button" className="context-button" onClick={() => setJdOpen(true)}><BriefcaseBusiness size={15}/>{jd.trim() ? 'Job context attached' : 'Add job context'}</button><div className="send-controls"><span>{input.length ? `${input.length}/4000` : 'Shift + Enter for a new line'}</span>{busy ? <button type="button" className="send-button" aria-label="Stop generation" onClick={() => controller.current?.abort()}><Square size={16} fill="currentColor"/></button> : <button className="send-button" type="submit" disabled={!input.trim()} aria-label="Send message"><ArrowUp size={20}/></button>}</div></div></form><p className="disclaimer">AI can make mistakes. Verify important details against the resume.</p></footer>
      </main>
      {jdOpen && <div className="modal-backdrop" onClick={() => setJdOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="jd-title" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') setJdOpen(false); }}><div className="modal-heading"><div><div className="eyebrow">ROLE ALIGNMENT</div><h2 id="jd-title">Add a job description</h2></div><button className="icon-button" onClick={() => setJdOpen(false)} aria-label="Close dialog"><X size={20}/></button></div><p>Paste the role requirements. The assistant will compare them with documented resume evidence.</p><textarea autoFocus value={jd} maxLength={15000} disabled={busy} onChange={event => setJd(event.target.value)} placeholder="Paste the job description here…" aria-label="Job description"/><div className="modal-meta"><span>{jd.length.toLocaleString()} / 15,000 characters</span><button className="text-button" disabled={busy} onClick={() => setJd('')}>Remove context</button></div><div className="privacy-note">This chat and job description are saved in this browser. Sent context is processed by your backend and Groq. Avoid confidential information.</div><div className="modal-actions"><button className="secondary-button" onClick={() => setJdOpen(false)}>Done</button><button className="primary-button" disabled={!jd.trim() || busy} onClick={() => { setJdOpen(false); send('Assess this candidate’s fit for the attached job description. Explain documented matches, requirements not evidenced, and what to verify in an interview.'); }}>Analyze fit <ArrowUp size={16}/></button></div></section></div>}
    </div>
  );
}
