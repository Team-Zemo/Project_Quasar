import { useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import type { CodingQuestion } from '../types/interview';
import { motion, AnimatePresence } from 'framer-motion';
import { Code2, Info, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface CodeEditorProps {
  question: CodingQuestion;
  onSubmit: (code: string, language: string) => void;
}

const LANGUAGES = [
  { label: 'Python', value: 'python', stub: '# Write your solution here\n\ndef solution():\n    pass\n' },
  { label: 'JavaScript', value: 'javascript', stub: '// Write your solution here\n\nfunction solution() {\n\n}\n' },
  { label: 'TypeScript', value: 'typescript', stub: '// Write your solution here\n\nfunction solution(): void {\n\n}\n' },
  { label: 'Java', value: 'java', stub: '// Write your solution here\n\nclass Solution {\n    public void solve() {\n        \n    }\n}\n' },
  { label: 'C++', value: 'cpp', stub: '// Write your solution here\n#include <bits/stdc++.h>\nusing namespace std;\n\nvoid solution() {\n\n}\n' },
  { label: 'Go', value: 'go', stub: '// Write your solution here\npackage main\n\nfunc solution() {\n\n}\n' },
  { label: 'Rust', value: 'rust', stub: '// Write your solution here\n\nfn solution() {\n\n}\n' },
  { label: 'C#', value: 'csharp', stub: '// Write your solution here\n\nclass Solution {\n    public void Solve() {\n        \n    }\n}\n' },
];

function guessInitialLanguage(preferred: string): string {
  const lower = preferred.toLowerCase();
  for (const lang of LANGUAGES) {
    if (lower.includes(lang.label.toLowerCase()) || lower.includes(lang.value)) {
      return lang.value;
    }
  }
  return 'python';
}

export function CodeEditor({ question, onSubmit }: CodeEditorProps) {
  const [selectedLang, setSelectedLang] = useState(() => guessInitialLanguage(question.preferredLanguage));
  const [code, setCode] = useState(() => {
    const lang = LANGUAGES.find(l => l.value === guessInitialLanguage(question.preferredLanguage));
    return lang?.stub ?? '';
  });
  const [confirming, setConfirming] = useState(false);

  const handleLangChange = useCallback((newLang: string) => {
    setSelectedLang(newLang);
    const lang = LANGUAGES.find(l => l.value === newLang);
    setCode(lang?.stub ?? '');
  }, []);

  const handleSubmit = useCallback(() => {
    const langLabel = LANGUAGES.find(l => l.value === selectedLang)?.label ?? selectedLang;
    onSubmit(code, langLabel);
  }, [code, selectedLang, onSubmit]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="flex flex-col w-full max-w-[1200px] h-[90vh] bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 lg:p-6 bg-[var(--c-surface-2)] border-b border-[var(--c-border)]">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[10px] font-bold uppercase tracking-widest rounded-full">
                <Code2 size={12} strokeWidth={2.5} />
                Coding Challenge
              </span>
            </div>
            <h2 className="text-[20px] font-bold text-[var(--c-text)] m-0 tracking-tight leading-tight">
              {question.title}
            </h2>
          </div>
          
          <div className="flex items-center gap-1.5 p-1 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg overflow-x-auto max-w-full">
            {LANGUAGES.map(lang => (
              <button
                key={lang.value}
                className={`px-3 py-1.5 text-[12px] font-bold rounded-md transition-all whitespace-nowrap ${
                  selectedLang === lang.value 
                    ? 'bg-[var(--c-accent)] text-white shadow-sm' 
                    : 'text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-3)]'
                }`}
                onClick={() => handleLangChange(lang.value)}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body: problem + editor side by side */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* Problem description */}
          <div className="flex flex-col w-full lg:w-[400px] flex-shrink-0 p-6 overscroll-contain overflow-y-auto border-b lg:border-b-0 lg:border-r border-[var(--c-border)] bg-[var(--c-surface)] custom-scrollbar">
            <div className="text-[11px] font-black uppercase tracking-wider text-[var(--c-text-dim)] mb-4">Problem Statement</div>
            <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-[var(--c-text)] mb-6">
              {question.description.split('\n').map((line, i) => (
                <p key={i} className="m-0 break-words">{line || <>&nbsp;</>}</p>
              ))}
            </div>
            {question.preferredLanguage && question.preferredLanguage !== 'Any' && (
              <div className="flex items-center gap-2 mt-auto p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[13px] text-blue-400 font-medium">
                <Info size={16} strokeWidth={2.5} className="shrink-0" />
                <span>Preferred language: <strong>{question.preferredLanguage}</strong></span>
              </div>
            )}
          </div>

          {/* Monaco editor */}
          <div className="flex-1 min-w-0 min-h-0 bg-[#1e1e1e] relative">
            <Editor
              height="100%"
              language={selectedLang}
              value={code}
              onChange={(val) => setCode(val ?? '')}
              theme="vs-dark"
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                padding: { top: 16, bottom: 16 },
                renderLineHighlight: 'line',
                cursorBlinking: 'smooth',
                smoothScrolling: true,
                automaticLayout: true,
                tabSize: 4,
                wordWrap: 'on',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 lg:p-5 bg-[var(--c-surface-2)] border-t border-[var(--c-border)]">
          <p className="flex items-center gap-2 text-[12px] text-[var(--c-text-mute)] max-w-[500px] leading-snug m-0">
            <AlertCircle size={14} strokeWidth={2.5} className="shrink-0 text-orange-500" />
            No execution environment — write a clear, readable implementation. The interviewer will evaluate your logic.
          </p>
          <div className="flex items-center gap-3 shrink-0">
            <AnimatePresence mode="wait">
              {!confirming ? (
                <motion.button
                  key="submit"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  id="code-submit-btn"
                  className={`flex items-center justify-center gap-2 px-6 py-2.5 font-bold text-[14px] rounded-xl transition-all shadow-sm ${
                    !code.trim() 
                      ? 'bg-[var(--c-surface-3)] text-[var(--c-text-mute)] cursor-not-allowed'
                      : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white shadow-[0_4px_12px_rgba(249,115,22,0.3)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] active:scale-95'
                  }`}
                  onClick={() => setConfirming(true)}
                  disabled={!code.trim()}
                >
                  <Sparkles size={16} strokeWidth={2.5} />
                  Submit Solution
                </motion.button>
              ) : (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-3 bg-[var(--c-surface)] p-1.5 pr-2 rounded-xl border border-[var(--c-border)] shadow-md"
                >
                  <span className="text-[13px] font-bold text-[var(--c-text)] pl-3 pr-2 hidden sm:inline-block">Submit code?</span>
                  <button 
                    className="px-4 py-1.5 text-[13px] font-semibold rounded-lg bg-[var(--c-surface-2)] hover:bg-[var(--c-surface-3)] text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors" 
                    onClick={() => setConfirming(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    id="code-confirm-submit-btn" 
                    className="flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-bold rounded-lg bg-[var(--c-success)] hover:bg-[#22c55e] text-white shadow-[0_2px_8px_rgba(34,197,94,0.3)] transition-colors active:scale-95" 
                    onClick={handleSubmit}
                  >
                    <CheckCircle2 size={14} strokeWidth={2.5} />
                    Confirm
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
