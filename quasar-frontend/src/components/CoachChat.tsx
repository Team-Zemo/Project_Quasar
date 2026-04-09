import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiFetchRaw } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, LineChart, BookOpen, Lightbulb, Map, Send, Square, Target, Bot, Search } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  { icon: <Search size={18} className="text-orange-500" />, text: 'Find job opportunities matching my skills' },
  { icon: <Calendar size={18} className="text-orange-500" />, text: 'Create a 2-week prep plan for FAANG interviews' },
  { icon: <Clock size={18} className="text-orange-500" />, text: 'How to manage interview prep while working full-time?' },
  { icon: <LineChart size={18} className="text-orange-500" />, text: 'Analyze my performance and give improvement tips' },
  { icon: <BookOpen size={18} className="text-orange-500" />, text: 'Recommend courses to improve my weak areas' },
  { icon: <Lightbulb size={18} className="text-orange-500" />, text: 'Best STAR method strategies for behavioral rounds' },
  { icon: <Map size={18} className="text-orange-500" />, text: 'Create a 3-month career growth roadmap' },
  { icon: <Search size={18} className="text-orange-500" />, text: 'Show me remote or internship job openings' },
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

      const res = await apiFetchRaw('/api/coach/chat', {
        method: 'POST',
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
    <div className="flex flex-col mx-auto w-full max-w-[860px] flex-1 min-h-0">
      {/* Chat area */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--c-surface-3)_transparent] px-4 pt-6 pb-2 md:px-6">
        <AnimatePresence mode="wait">
          {isEmpty ? (
            <motion.div 
              key="welcome"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center min-h-full text-center gap-3 py-4 px-4 sm:py-8"
            >
              <div className="flex items-center justify-center w-20 h-20 bg-orange-500/10 text-orange-500 rounded-[24px] mb-2 shadow-inner">
                <Target size={40} strokeWidth={2.5} />
              </div>
              <h1 className="text-[32px] max-sm:text-[24px] font-black tracking-tight text-[var(--c-text)]">Quasar Coach</h1>
              <p className="text-[14px] sm:text-[15px] text-[var(--c-text-dim)] max-w-[480px] leading-relaxed">
                Your AI career coach — personalized interview prep, time management, and career planning
              </p>

              {/* Suggestion chips */}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] max-sm:grid-cols-1 gap-3 mt-8 w-full max-w-[620px]">
                {SUGGESTIONS.map((s, i) => (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 + 0.1 }}
                    key={i}
                    className="flex items-center gap-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl cursor-pointer text-left transition-all duration-200 hover:bg-[var(--c-surface-2)] hover:border-orange-500/30 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(234,88,12,0.08)] disabled:opacity-50 disabled:pointer-events-none group"
                    style={{ padding: '14px 20px' }}
                    onClick={() => handleSuggestion(s.text)}
                    disabled={streaming}
                  >
                    <div className="shrink-0 transition-transform group-hover:scale-110">
                      {s.icon}
                    </div>
                    <span className="text-[14px] text-[var(--c-text-dim)] leading-snug group-hover:text-[var(--c-text)] transition-colors">{s.text}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-6"
              style={{ paddingBottom: '24px' }}
            >
              {messages.map((msg) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ease: "easeOut" }}
                  key={msg.id} 
                  className="flex gap-4 max-sm:gap-3 p-2"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 shadow-sm ${msg.role === 'assistant' ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' : 'bg-[var(--c-surface-3)] text-[var(--c-text)]'}`}>
                    {msg.role === 'assistant' ? <Bot size={22} className="text-white" /> : user?.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <span className={`block text-[13px] font-bold mb-1.5 ${msg.role === 'assistant' ? 'text-orange-500' : 'text-[var(--c-text-dim)]'}`}>
                      {msg.role === 'assistant' ? 'Quasar Coach' : user?.name || 'You'}
                    </span>
                    <div className="text-[14px] sm:text-[15px] leading-relaxed [&_p]:mb-4 [&_p:last-child]:mb-0 [&_h1]:text-[18px] sm:[&_h1]:text-[20px] [&_h1]:font-extrabold [&_h1]:mb-4 [&_h2]:text-[16px] sm:[&_h2]:text-[17px] [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-6 [&_h3]:text-[14px] sm:[&_h3]:text-[15px] [&_h3]:font-bold [&_h3]:mb-2 [&_h3]:mt-5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_li]:mb-1 [&_li::marker]:text-[var(--c-text-mute)] [&_strong]:font-bold [&_strong]:text-[var(--c-text)] [&_a]:text-orange-500 [&_a]:underline [&_a:hover]:text-orange-400 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--c-border-2)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[var(--c-text-dim)] [&_code]:font-mono [&_code]:text-[13px] [&_code]:bg-[var(--c-surface-3)] [&_code]:text-orange-300 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_pre]:bg-[#0d0d12] [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_pre]:mb-4 [&_pre]:border [&_pre]:border-[var(--c-border)] [&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0 [&_pre_code]:text-[var(--c-text-dim)] [&_table]:w-full [&_table]:mb-4 [&_table]:border-collapse [&_th]:text-left [&_th]:border-b [&_th]:border-[var(--c-border-2)] [&_th]:p-2 [&_th]:text-[var(--c-text)] [&_td]:border-b [&_td]:border-[var(--c-border-2)] [&_td]:p-2 [&_td]:text-[var(--c-text-dim)] [&_hr]:border-none [&_hr]:border-t [&_hr]:border-[var(--c-border-2)] [&_hr]:my-6">
                      {msg.role === 'assistant' ? (
                        msg.content ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        ) : (
                          <div className="flex items-center gap-1.5 py-3 h-6">
                            <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} className="w-[5px] h-[5px] rounded-full bg-orange-400" />
                            <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} className="w-[5px] h-[5px] rounded-full bg-orange-400" />
                            <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} className="w-[5px] h-[5px] rounded-full bg-orange-400" />
                          </div>
                        )
                      ) : (
                        <p className="text-[var(--c-text)]">{msg.content}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
              <div ref={bottomRef} className="h-4" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input bar */}
      <div className="border-t border-[var(--c-border)] bg-[var(--c-surface)] shrink-0 w-full px-4 py-3 md:px-6 md:py-4">
        <form className="flex items-end gap-3 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-[18px] transition-colors duration-200 focus-within:border-orange-500/50 focus-within:ring-2 focus-within:ring-orange-500/10 shadow-sm p-1.5 px-3 md:p-2 md:px-3" onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            className="flex-1 bg-transparent border-none outline-none text-[var(--c-text)] text-[15px] font-inherit resize-none min-h-[36px] max-h-[160px] leading-relaxed placeholder:text-[var(--c-text-mute)] py-1.5 md:py-2 px-1 md:px-2"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about interview prep, career planning, time management…"
            rows={1}
            disabled={streaming}
          />
          {streaming ? (
            <button type="button" className="w-10 h-10 mb-0.5 rounded-[12px] border-none flex items-center justify-center cursor-pointer transition-all duration-200 shrink-0 bg-red-500/10 text-red-500 hover:bg-red-500/20 active:scale-95" onClick={handleStop} title="Stop">
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              className="w-10 h-10 mb-0.5 rounded-[12px] border-none flex items-center justify-center cursor-pointer transition-all duration-200 shrink-0 bg-orange-500 text-white hover:not(:disabled):bg-orange-600 hover:not(:disabled):scale-105 active:not(:disabled):scale-95 disabled:opacity-30 disabled:cursor-default shadow-sm"
              disabled={!input.trim()}
              title="Send"
            >
              <Send size={16} strokeWidth={2.5} className="mr-0.5 mt-0.5" />
            </button>
          )}
        </form>
        <p className="text-[11px] font-medium text-[var(--c-text-mute)] text-center mt-3">
          Quasar Coach is an AI assistant. Advice is AI-generated — use your best judgment.
        </p>
      </div>
    </div>
  );
}
