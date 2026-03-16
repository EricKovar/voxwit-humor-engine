import { FormEvent, useMemo, useState } from 'react';
import './App.css';

interface HookResult {
  structure: string;
  text: string;
  score: number;
}

interface LogEntry {
  id: string;
  time: string;
  snippet: string;
  hooks: number;
}

const industries = ['SaaS', 'Fintech', 'Healthcare', 'Manufacturing', 'Consulting'];
const tones = ['professional', 'bold', 'warm'];

const defaultPost = 'Product teams should talk to customers earlier. We wait for churn before we run an interview, which is upside-down.';

function App() {
  const [postText, setPostText] = useState(defaultPost);
  const [industry, setIndustry] = useState('SaaS');
  const [tone, setTone] = useState('professional');
  const [maxHooks, setMaxHooks] = useState(4);
  const [hooks, setHooks] = useState<HookResult[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const topScore = useMemo(() => hooks[0]?.score ?? null, [hooks]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!postText.trim()) {
      setErrorMessage('Please paste a LinkedIn draft first.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const response = await fetch('/generate-hooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_text: postText,
          industry,
          tone,
          max_hooks: maxHooks,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const data = (await response.json()) as { hooks?: HookResult[] };
      const newHooks = data.hooks ?? [];
      setHooks(newHooks);
      setStatus('idle');

      setLog((previous) => [
        {
          id: crypto.randomUUID(),
          time: new Date().toLocaleTimeString(),
          snippet: postText.slice(0, 80),
          hooks: newHooks.length,
        },
        ...previous,
      ].slice(0, 5));
    } catch (error) {
      setStatus('error');
      setErrorMessage((error as Error).message ?? 'Unknown error');
    }
  };

  return (
    <div className="app-shell">
      <header>
        <div>
          <p className="eyebrow">VoxWit · Humor Engine</p>
          <h1>Demo clever hooks live in the browser</h1>
          <p className="subtitle">
            Paste a LinkedIn draft, tweak tone, and show investors the real-time hooks coming
            straight from the Fastify service on <code>localhost:4000</code>.
          </p>
        </div>
        <div className="status-card">
          <p className="label">Top score</p>
          <p className="value">{topScore ? topScore.toFixed(3) : '—'}</p>
          <p className="label">Hooks ready</p>
          <p className="value">{hooks.length || '—'}</p>
        </div>
      </header>

      <main>
        <section className="panel form-panel">
          <form onSubmit={handleSubmit}>
            <label htmlFor="postText">LinkedIn draft</label>
            <textarea
              id="postText"
              value={postText}
              onChange={(event) => setPostText(event.target.value)}
              rows={6}
              placeholder="Paste or write a LinkedIn hook..."
            />

            <div className="form-grid">
              <label>
                Industry
                <select value={industry} onChange={(event) => setIndustry(event.target.value)}>
                  {industries.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Tone
                <select value={tone} onChange={(event) => setTone(event.target.value)}>
                  {tones.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Max hooks
                <input
                  type="number"
                  min={3}
                  max={6}
                  value={maxHooks}
                  onChange={(event) => setMaxHooks(Number(event.target.value))}
                />
              </label>
            </div>

            <div className="actions">
              <button type="submit" disabled={status === 'loading'}>
                {status === 'loading' ? 'Generating…' : 'Generate hooks'}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setPostText(defaultPost)}
              >
                Load sample copy
              </button>
            </div>

            {status === 'error' && errorMessage && (
              <p className="error">{errorMessage}</p>
            )}
          </form>
        </section>

        <section className="panel results-panel">
          <div className="results-header">
            <h2>Hooks</h2>
            <span>{hooks.length ? `${hooks.length} results` : 'No hooks yet'}</span>
          </div>
          <div className="hook-grid">
            {hooks.map((hook) => (
              <article key={`${hook.structure}-${hook.text}`} className="hook-card">
                <div className="hook-meta">
                  <span className="structure">{hook.structure}</span>
                  <span className="score">Score {hook.score.toFixed(3)}</span>
                </div>
                <p>{hook.text}</p>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(hook.text)}
                >
                  Copy hook
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="panel log-panel">
          <div className="results-header">
            <h2>Live requests</h2>
            <span>Most recent 5</span>
          </div>
          <ul>
            {log.length === 0 && <li className="muted">Run a request to populate the log.</li>}
            {log.map((entry) => (
              <li key={entry.id}>
                <div>
                  <p className="log-snippet">{entry.snippet}{entry.snippet.length === 80 ? '…' : ''}</p>
                  <p className="log-meta">{entry.time} · {entry.hooks} hooks</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

export default App;
