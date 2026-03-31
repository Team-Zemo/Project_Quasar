import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  { icon: '📅', text: 'Create a 2-week prep plan for FAANG interviews' },
  { icon: '⏰', text: 'How to manage interview prep while working full-time?' },
  { icon: '🎯', text: 'Analyze my performance and give improvement tips' },
  { icon: '📚', text: 'Recommend courses to improve my weak areas' },
  { icon: '💡', text: 'Best STAR method strategies for behavioral rounds' },
  { icon: '🗺️', text: 'Create a 3-month career growth roadmap' },
];

export function CoachChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text.trim(),
    };

    const assistantMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: '',
    };

    const updatedMessages = [...messages, userMsg];
    setMessages([...updatedMessages, assistantMsg]);
    setInput('');
    setStreaming(true);

    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto';

    // Build chat history for API
    const apiMessages = updatedMessages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      abortRef.current = new AbortController();

      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const payload = line.slice(6);
              if (payload === '[DONE]') continue;
              try {
                const parsed = JSON.parse(payload);
                if (parsed.content) {
                  accumulated += parsed.content;
                  setMessages(prev => {
                    const newMsgs = [...prev];
                    const last = newMsgs[newMsgs.length - 1];
                    if (last.role === 'assistant') {
                      newMsgs[newMsgs.length - 1] = { ...last, content: accumulated };
                    }
                    return newMsgs;
                  });
                }
                if (parsed.error) {
                  accumulated += '\n\n*An error occurred while generating the response.*';
                  setMessages(prev => {
                    const newMsgs = [...prev];
                    const last = newMsgs[newMsgs.length - 1];
                    if (last.role === 'assistant') {
                      newMsgs[newMsgs.length - 1] = { ...last, content: accumulated };
                    }
                    return newMsgs;
                  });
                }
              } catch {
                // Skip malformed JSON chunks
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setMessages(prev => {
        const newMsgs = [...prev];
        const last = newMsgs[newMsgs.length - 1];
        if (last.role === 'assistant' && !last.content) {
          newMsgs[newMsgs.length - 1] = {
            ...last,
            content: '*Failed to get a response. Please try again.*',
          };
        }
        return newMsgs;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages, streaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleSuggestion = (text: string) => {
    sendMessage(text);
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="coach-page">
      {/* Chat area */}
      <div className="coach-chat-area">
        {isEmpty ? (
          <div className="coach-welcome">
            <div className="coach-welcome__icon">🎯</div>
            <h1 className="coach-welcome__title">Quasar Coach</h1>
            <p className="coach-welcome__subtitle">
              Your AI career coach — personalized interview prep, time management, and career planning
            </p>

            {/* Suggestion chips */}
            <div className="coach-suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  className="coach-suggestion"
                  onClick={() => handleSuggestion(s.text)}
                  disabled={streaming}
                >
                  <span className="coach-suggestion__icon">{s.icon}</span>
                  <span className="coach-suggestion__text">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="coach-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`coach-msg coach-msg--${msg.role}`}>
                <div className="coach-msg__avatar">
                  {msg.role === 'assistant' ? '🎯' : user?.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="coach-msg__body">
                  <span className="coach-msg__name">
                    {msg.role === 'assistant' ? 'Quasar Coach' : user?.name || 'You'}
                  </span>
                  <div className="coach-msg__content">
                    {msg.role === 'assistant' ? (
                      msg.content ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        <div className="coach-msg__thinking">
                          <span className="coach-thinking-dot" />
                          <span className="coach-thinking-dot" />
                          <span className="coach-thinking-dot" />
                        </div>
                      )
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="coach-input-bar">
        <form className="coach-input-form" onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            className="coach-input"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about interview prep, career planning, time management…"
            rows={1}
            disabled={streaming}
          />
          {streaming ? (
            <button type="button" className="coach-stop-btn" onClick={handleStop} title="Stop">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              className="coach-send-btn"
              disabled={!input.trim()}
              title="Send"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          )}
        </form>
        <p className="coach-disclaimer">
          Quasar Coach is an AI assistant. Advice is AI-generated — use your best judgment.
        </p>
      </div>
    </div>
  );
}
