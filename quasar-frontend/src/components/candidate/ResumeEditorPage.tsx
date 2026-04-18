import { useState, useEffect, useCallback, useRef } from "react";
import Editor from "@monaco-editor/react";
import {
  FileText, Download, Save, Trash2, Plus, ArrowLeft, Star,
  RefreshCw, Eye, Code, Sparkles, ChevronRight, Copy, Check,
} from "lucide-react";
import {
  fetchTemplates, transformResume, listResumes, getResume,
  createResume, updateResume, deleteResume, setDefaultResume,
  compileRawLatex, compileResumePdf, fetchTemplateSkeleton,
  type TemplateInfo, type SavedResume,
} from "../../lib/latexResumeApi";

type View = "list" | "pick-template" | "editor";

export function ResumeEditorPage() {
  const [view, setView] = useState<View>("list");
  const [resumes, setResumes] = useState<SavedResume[]>([]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [pdflatexAvailable, setPdflatexAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("My Resume");
  const [editTemplateId, setEditTemplateId] = useState("classic");
  const [latexSource, setLatexSource] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [transforming, setTransforming] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [compileError, setCompileError] = useState("");
  const [copied, setCopied] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [tplData, resumeList] = await Promise.all([fetchTemplates(), listResumes()]);
      setTemplates(tplData.templates);
      setPdflatexAvailable(tplData.pdflatexAvailable);
      setResumes(resumeList);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openEditor = async (resume: SavedResume) => {
    setLoading(true);
    try {
      const full = await getResume(resume._id);
      setEditingId(full._id);
      setEditName(full.name);
      setEditTemplateId(full.templateId);
      setLatexSource(full.latexSource || "");
      setDirty(false);
      setPdfUrl(null);
      setCompileError("");
      setView("editor");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const startNewFromTemplate = async (tplId: string, useAi: boolean) => {
    setTransforming(true);
    setError("");
    try {
      let source: string;
      if (useAi) {
        source = await transformResume(tplId);
      } else {
        source = await fetchTemplateSkeleton(tplId);
      }
      setEditingId(null);
      setEditName("Untitled Resume");
      setEditTemplateId(tplId);
      setLatexSource(source);
      setDirty(true);
      setPdfUrl(null);
      setCompileError("");
      setView("editor");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTransforming(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      if (editingId) {
        await updateResume(editingId, { name: editName, latexSource });
      } else {
        const created = await createResume({ name: editName, templateId: editTemplateId, latexSource });
        setEditingId(created._id);
      }
      setDirty(false);
      setSaveMsg("Saved!");
      setTimeout(() => setSaveMsg(""), 2000);
      loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCompile = async () => {
    setCompiling(true);
    setCompileError("");
    if (pdfUrl) { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); }
    try {
      const blob = editingId
        ? await compileResumePdf(editingId)
        : await compileRawLatex(latexSource);
      setPdfUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      setCompileError(e.message);
    } finally {
      setCompiling(false);
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${editName.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
    a.click();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this resume?")) return;
    try {
      await deleteResume(id);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultResume(id);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(latexSource);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const goBack = () => {
    if (view === "editor" && dirty && !confirm("Discard unsaved changes?")) return;
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setView("list");
    loadData();
  };

  // ─── List View ────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="w-full max-w-5xl mx-auto" id="resume-editor-list">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[28px] font-black tracking-tight text-[var(--c-text)]">Resume Editor</h1>
            <p className="text-[14px] text-[var(--c-text-dim)] mt-1">Create beautiful LaTeX resumes from your profile data</p>
          </div>
          <button onClick={() => setView("pick-template")} className="btn-primary btn-small flex items-center gap-2" id="new-resume-btn">
            <Plus size={16} /> New Resume
          </button>
        </div>
        {error && <div className="mb-4 p-3 rounded-xl bg-[var(--c-error-dim)] border border-red-500/20 text-[var(--c-error)] text-sm">{error}</div>}
        {loading ? (
          <div className="flex justify-center py-20"><div className="spinner" /></div>
        ) : resumes.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--c-surface-2)] flex items-center justify-center border border-[var(--c-border)]">
              <FileText size={32} className="text-[var(--c-text-mute)]" />
            </div>
            <p className="text-[var(--c-text-dim)] text-lg font-semibold mb-2">No resumes yet</p>
            <p className="text-[var(--c-text-mute)] text-sm mb-6">Pick a template and let AI fill it with your resume data</p>
            <button onClick={() => setView("pick-template")} className="btn-primary">
              <Sparkles size={16} /> Create Your First Resume
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resumes.map((r) => (
              <div key={r._id} className="group relative rounded-2xl bg-[var(--c-surface)] border border-[var(--c-border)] p-5 hover:border-[var(--c-accent)]/40 transition-all cursor-pointer" onClick={() => openEditor(r)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-[var(--c-accent)]" />
                    <span className="font-bold text-[15px] text-[var(--c-text)]">{r.name}</span>
                  </div>
                  {r.isDefault && <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full"><Star size={10} fill="currentColor" /> Default</span>}
                </div>
                <p className="text-[12px] text-[var(--c-text-mute)] mb-1">Template: <span className="text-[var(--c-text-dim)] capitalize">{r.templateId}</span></p>
                <p className="text-[11px] text-[var(--c-text-mute)]">Updated {new Date(r.updatedAt).toLocaleDateString()}</p>
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  {!r.isDefault && (
                    <button onClick={() => handleSetDefault(r._id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--c-text-mute)] hover:text-amber-400 hover:bg-amber-400/10" title="Set as default"><Star size={14} /></button>
                  )}
                  <button onClick={() => handleDelete(r._id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--c-text-mute)] hover:text-[var(--c-error)] hover:bg-[var(--c-error-dim)]" title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Template Picker View ─────────────────────────────
  if (view === "pick-template") {
    return (
      <div className="w-full max-w-4xl mx-auto" id="resume-template-picker">
        <button onClick={() => setView("list")} className="flex items-center gap-2 text-[var(--c-text-dim)] hover:text-[var(--c-text)] text-sm font-semibold mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to resumes
        </button>
        <h1 className="text-[28px] font-black tracking-tight text-[var(--c-text)] mb-2">Choose a Template</h1>
        <p className="text-[14px] text-[var(--c-text-dim)] mb-8">Select a LaTeX template, then let AI populate it with your resume data — or start from scratch.</p>
        {error && <div className="mb-4 p-3 rounded-xl bg-[var(--c-error-dim)] border border-red-500/20 text-[var(--c-error)] text-sm">{error}</div>}
        {transforming && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-[var(--c-surface)] rounded-2xl border border-[var(--c-border)] p-8 text-center max-w-sm">
              <div className="spinner mx-auto mb-4" style={{ borderTopColor: "var(--c-accent)", borderColor: "rgba(249,115,22,0.15)", width: 32, height: 32 }} />
              <p className="text-[var(--c-text)] font-bold text-lg mb-1">Transforming Resume…</p>
              <p className="text-[var(--c-text-dim)] text-sm">AI is converting your resume into LaTeX</p>
            </div>
          </div>
        )}
        <div className="grid gap-6 sm:grid-cols-3">
          {templates.map((tpl) => (
            <div key={tpl.id} className="rounded-2xl bg-[var(--c-surface)] border border-[var(--c-border)] overflow-hidden hover:border-[var(--c-accent)]/40 transition-all group">
              {/* Preview header */}
              <div className="h-40 bg-[var(--c-surface-2)] flex items-center justify-center border-b border-[var(--c-border)] relative overflow-hidden">
                <div className="text-center px-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--c-accent-dim)] flex items-center justify-center mx-auto mb-2">
                    <FileText size={20} className="text-[var(--c-accent)]" />
                  </div>
                  <p className="text-[13px] font-bold text-[var(--c-text)] capitalize">{tpl.id}</p>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--c-surface)] to-transparent opacity-0 group-hover:opacity-60 transition-opacity" />
              </div>
              <div className="p-4">
                <h3 className="font-bold text-[15px] text-[var(--c-text)] mb-1">{tpl.name}</h3>
                <p className="text-[12px] text-[var(--c-text-mute)] mb-4 leading-relaxed">{tpl.description}</p>
                <div className="flex flex-col gap-2">
                  <button onClick={() => startNewFromTemplate(tpl.id, true)} disabled={transforming} className="btn-primary btn-small w-full flex items-center justify-center gap-2">
                    <Sparkles size={14} /> AI Fill
                  </button>
                  <button onClick={() => startNewFromTemplate(tpl.id, false)} disabled={transforming} className="btn-secondary w-full flex items-center justify-center gap-2 text-[12px]">
                    <Code size={14} /> Blank Template
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Editor View ──────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-80px)] w-full max-w-[100vw]" id="resume-latex-editor">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[var(--c-surface)] border-b border-[var(--c-border)] shrink-0">
        <button onClick={goBack} className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors" title="Back">
          <ArrowLeft size={18} />
        </button>
        <div className="h-5 w-px bg-[var(--c-border)]" />
        <input
          value={editName}
          onChange={(e) => { setEditName(e.target.value); setDirty(true); }}
          className="bg-transparent text-[var(--c-text)] font-bold text-[15px] border-none outline-none w-48 placeholder:text-[var(--c-text-mute)]"
          placeholder="Resume name…"
        />
        <span className="text-[11px] text-[var(--c-text-mute)] uppercase tracking-wider font-bold capitalize">{editTemplateId}</span>
        {dirty && <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Unsaved</span>}
        {saveMsg && <span className="text-[10px] text-[var(--c-success)] font-bold uppercase tracking-wider">{saveMsg}</span>}
        <div className="flex-1" />

        <button onClick={handleCopy} className="btn-secondary flex items-center gap-1.5 text-[11px] px-3 py-1.5" title="Copy LaTeX">
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
        </button>
        <button onClick={() => setShowPreview(!showPreview)} className={`btn-secondary flex items-center gap-1.5 text-[11px] px-3 py-1.5 ${showPreview ? "border-[var(--c-accent)]/40 text-[var(--c-accent)]" : ""}`}>
          <Eye size={13} /> Preview
        </button>
        <button onClick={handleCompile} disabled={compiling || !latexSource} className="btn-secondary flex items-center gap-1.5 text-[11px] px-3 py-1.5">
          {compiling ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {compiling ? "Compiling…" : "Compile PDF"}
        </button>
        {pdfUrl && (
          <button onClick={handleDownload} className="btn-secondary flex items-center gap-1.5 text-[11px] px-3 py-1.5 text-[var(--c-success)] border-green-500/30">
            <Download size={13} /> Download
          </button>
        )}
        <button onClick={handleSave} disabled={saving || !latexSource} className="btn-primary btn-small flex items-center gap-1.5">
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Compile Error Banner */}
      {compileError && (
        <div className="px-4 py-2 bg-[var(--c-error-dim)] border-b border-red-500/20 text-[var(--c-error)] text-[12px] font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
          {compileError}
        </div>
      )}

      {/* Editor + Preview */}
      <div className="flex-1 flex min-h-0">
        {/* Monaco Editor */}
        <div className={`flex flex-col ${showPreview && pdfUrl ? "w-1/2" : "w-full"} min-h-0 border-r border-[var(--c-border)]`}>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--c-surface-2)] border-b border-[var(--c-border)] text-[11px] font-bold text-[var(--c-text-mute)] uppercase tracking-wider">
            <Code size={12} /> LaTeX Source
          </div>
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              language="latex"
              theme="vs-dark"
              value={latexSource}
              onChange={(v) => { setLatexSource(v || ""); setDirty(true); }}
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                minimap: { enabled: false },
                wordWrap: "on",
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                padding: { top: 12 },
                renderWhitespace: "selection",
                bracketPairColorization: { enabled: true },
                automaticLayout: true,
              }}
            />
          </div>
        </div>

        {/* PDF Preview */}
        {showPreview && pdfUrl && (
          <div className="w-1/2 flex flex-col min-h-0 bg-[#1a1a2e]">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--c-surface-2)] border-b border-[var(--c-border)] text-[11px] font-bold text-[var(--c-text-mute)] uppercase tracking-wider">
              <Eye size={12} /> PDF Preview
            </div>
            <div className="flex-1 min-h-0">
              <iframe src={pdfUrl} className="w-full h-full border-0" title="PDF Preview" />
            </div>
          </div>
        )}

        {/* No preview state */}
        {showPreview && !pdfUrl && (
          <div className="w-1/2 flex flex-col items-center justify-center bg-[var(--c-surface)] text-center p-8 min-h-0">
            <div className="w-16 h-16 rounded-2xl bg-[var(--c-surface-2)] flex items-center justify-center border border-[var(--c-border)] mb-4">
              <Eye size={28} className="text-[var(--c-text-mute)]" />
            </div>
            <p className="text-[var(--c-text-dim)] font-semibold mb-1">No Preview Yet</p>
            <p className="text-[var(--c-text-mute)] text-sm mb-4">Click "Compile PDF" to generate a preview</p>
            {!pdflatexAvailable && (
              <p className="text-[11px] text-amber-400/70 bg-amber-400/5 rounded-lg px-3 py-2 border border-amber-400/10">
                ⚠ pdflatex not detected on server. Install TeX Live for PDF compilation.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
