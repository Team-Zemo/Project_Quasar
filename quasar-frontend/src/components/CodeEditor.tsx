import { useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import type { CodingQuestion } from '../types/interview';

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
    <div className="code-editor-overlay">
      <div className="code-editor-panel">
        {/* Header */}
        <div className="code-editor-header">
          <div className="code-editor-header__left">
            <span className="code-editor-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
              Coding Challenge
            </span>
            <h2 className="code-editor-title">{question.title}</h2>
          </div>
          <div className="code-editor-lang-picker">
            {LANGUAGES.map(lang => (
              <button
                key={lang.value}
                className={`lang-btn ${selectedLang === lang.value ? 'lang-btn--active' : ''}`}
                onClick={() => handleLangChange(lang.value)}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body: problem + editor side by side */}
        <div className="code-editor-body">
          {/* Problem description */}
          <div className="code-problem">
            <div className="code-problem__label">Problem Statement</div>
            <div className="code-problem__text">
              {question.description.split('\n').map((line, i) => (
                <p key={i}>{line || <>&nbsp;</>}</p>
              ))}
            </div>
            {question.preferredLanguage && question.preferredLanguage !== 'Any' && (
              <div className="code-problem__lang-hint">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Preferred language: <strong>{question.preferredLanguage}</strong>
              </div>
            )}
          </div>

          {/* Monaco editor */}
          <div className="code-monaco-wrapper">
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
        <div className="code-editor-footer">
          <p className="code-editor-footer__hint">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            No code runner — write a clear, readable implementation. The interviewer will evaluate your approach and logic.
          </p>
          <div className="code-editor-footer__actions">
            {!confirming ? (
              <button
                id="code-submit-btn"
                className="btn-primary"
                onClick={() => setConfirming(true)}
                disabled={!code.trim()}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Submit Solution
              </button>
            ) : (
              <div className="code-confirm-row">
                <span className="code-confirm-text">Submit and resume interview?</span>
                <button className="btn-secondary" onClick={() => setConfirming(false)}>Cancel</button>
                <button id="code-confirm-submit-btn" className="btn-primary" onClick={handleSubmit}>
                  Confirm Submit
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
