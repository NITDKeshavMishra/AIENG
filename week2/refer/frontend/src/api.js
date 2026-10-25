const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

export async function streamChat(payload, signal, onToken) {
  const response = await fetch(`${API}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, stream: true }),
    signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const detail = typeof data?.detail === 'string' ? data.detail : null;
    throw new Error(detail || `Request failed (${response.status}). Check the backend logs.`);
  }
  if (!response.body) throw new Error('Your browser did not provide a response stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;
  let finishReason = null;

  function consume() {
    let separator;
    while ((separator = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      let event = 'message';
      const lines = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) lines.push(line.slice(5).trimStart());
      }
      if (!lines.length) continue;
      const data = JSON.parse(lines.join('\n'));
      if (event === 'token' && typeof data.text === 'string') onToken(data.text);
      if (event === 'error') throw new Error(data.message || 'The response was interrupted.');
      if (event === 'done') { finished = true; finishReason = data.finish_reason; }
    }
  }

  try {
    while (!finished) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      // This backend emits LF-delimited SSE events. Network chunks may split anywhere.
      consume();
      if (done) break;
    }
    if (!finished) throw new Error('Connection closed before the answer finished. Please try again.');
    return finishReason;
  } finally {
    try { await reader.cancel(); } catch { /* Already closed or aborted. */ }
    reader.releaseLock();
  }
}
