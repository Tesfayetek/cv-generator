import React, { useState } from 'react';
import {
  BookmarkPlus,
  Check,
  Clock,
  Loader2,
  RefreshCw,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { DEFAULT_DESIGN_CONFIG, SAMPLE_CV_PROFILES } from '../../data/presets';
import type {
  AIDesignHistoryEntry,
  CVDocument,
  DesignConfiguration,
} from '../../types/cv';
import { CVRenderer } from '../cv/CVRenderer';

interface AIDesignGeneratorViewProps {
  activeCV: CVDocument | null;
  history: AIDesignHistoryEntry[];
  aiEnabled: boolean;
  onSaveHistoryEntry: (prompt: string, rationale: string, config: DesignConfiguration) => Promise<void>;
  onApplyDesignToCV: (config: DesignConfiguration) => Promise<void>;
  onSaveCustomDesign: (name: string, description: string, config: DesignConfiguration) => Promise<void>;
  onOpenStudio: () => void;
}

const EXAMPLE_PROMPTS = [
  'Generate an elegant navy-blue executive CV with a modern two-column layout.',
  'Create a formal NGO consultant CV with a clean white background and dark-blue headings.',
  'Design a minimalist ATS-friendly CV without graphics.',
  'Create a premium international development specialist CV.',
  'Generate an elegant academic CV with sections for publications and research.',
  'Design a professional management CV with a strong executive profile.',
  'Create a modern technology CV with a compact skills sidebar.',
];

export const AIDesignGeneratorView: React.FC<AIDesignGeneratorViewProps> = ({
  activeCV,
  history,
  aiEnabled,
  onSaveHistoryEntry,
  onApplyDesignToCV,
  onSaveCustomDesign,
  onOpenStudio,
}) => {
  const [prompt, setPrompt] = useState('');
  const [refineMode, setRefineMode] = useState(false);
  const [atsPriority, setAtsPriority] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rationale, setRationale] = useState('');
  const [generatedConfig, setGeneratedConfig] = useState<DesignConfiguration>(
    activeCV?.designOverrides || DEFAULT_DESIGN_CONFIG
  );
  const [savedNotice, setSavedNotice] = useState('');
  const [customName, setCustomName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  const previewCV: CVDocument = activeCV || {
    ...SAMPLE_CV_PROFILES.executive,
    cvId: 'ai_preview',
    userId: 'preview',
    selectedTemplateId: 'tpl_classic_executive',
    createdAt: '',
    updatedAt: '',
  };

  const handleGenerate = async (customPrompt?: string) => {
    const finalPrompt = (customPrompt ?? prompt).trim();
    if (!finalPrompt) return;
    setError('');
    setSavedNotice('');
    setLoading(true);
    try {
      const resp = await fetch('/api/ai/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          atsRequired: atsPriority,
          currentConfiguration: refineMode ? generatedConfig : undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'AI design generation failed.');
      setGeneratedConfig(data.designConfiguration);
      setRationale(data.rationale || '');
      setRefineMode(true);
      await onSaveHistoryEntry(finalPrompt, data.rationale || '', data.designConfiguration);
    } catch (err: any) {
      setError(err?.message || 'Could not generate design configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAndEdit = async () => {
    await onApplyDesignToCV(generatedConfig);
    setSavedNotice('Design applied to your CV');
    onOpenStudio();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="pb-6 border-b border-slate-200 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#142B4A] tracking-tight">
            AI Design Generator
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Describe your ideal CV layout, palette, and typography in natural language. Output is a live, editable, exportable HTML/CSS CV configuration.
          </p>
        </div>
        {activeCV && (
          <div className="text-xs font-medium text-slate-600">
            Active CV: <strong className="text-[#142B4A]">{activeCV.cvTitle}</strong>
          </div>
        )}
      </div>

      <div className="mt-6 grid lg:grid-cols-12 gap-6 items-start">
        {/* Left Control & Prompt Column */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            {!aiEnabled && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                AI generation is currently disabled in Administrator Settings.
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#142B4A] mb-1.5">
                Describe the CV design you want
              </label>
              <textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Generate an elegant navy-blue executive CV with a modern two-column layout, Garamond headings, and clean skill tags..."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2864A6]/25 focus:border-[#2864A6]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={refineMode}
                  onChange={(e) => setRefineMode(e.target.checked)}
                />
                <span>Refine current design iteratively</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={atsPriority}
                  onChange={(e) => setAtsPriority(e.target.checked)}
                />
                <span>Prioritize ATS layout</span>
              </label>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between gap-2">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => handleGenerate()}
                  className="font-semibold underline inline-flex items-center gap-1 shrink-0"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading || !prompt.trim() || !aiEnabled}
                onClick={() => handleGenerate()}
                className="flex-1 py-2.5 px-4 bg-[#142B4A] hover:bg-[#1e3d66] disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{loading ? 'Generating Design...' : refineMode ? 'Refine Design' : 'Generate Design'}</span>
              </button>
              {refineMode && (
                <button
                  type="button"
                  onClick={() => setRefineMode(false)}
                  className="px-3 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Fresh
                </button>
              )}
            </div>

            {rationale && (
              <div className="p-3 bg-[#EAF2FB]/60 border border-[#2864A6]/20 rounded-xl text-xs text-[#142B4A] leading-relaxed">
                <span className="font-bold block mb-0.5">Design Configuration Summary:</span>
                {rationale}
              </div>
            )}

            {/* Quick Example Prompts */}
            <div className="pt-3 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-700 mb-2">Example Design Prompts</div>
              <div className="space-y-1.5">
                {EXAMPLE_PROMPTS.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setPrompt(ex);
                      setRefineMode(false);
                      handleGenerate(ex);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 bg-slate-50 hover:bg-[#EAF2FB] hover:text-[#142B4A] rounded-lg border border-slate-200/80 transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Prompt History */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#142B4A]">
              <Clock className="w-4 h-4 text-[#2864A6]" />
              <span>Design Prompt History ({history.length})</span>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-slate-500">
                Generated designs will appear here so you can return to earlier versions at any time.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto studio-scroll">
                {history.map((entry) => (
                  <button
                    key={entry.historyId}
                    type="button"
                    onClick={() => {
                      setGeneratedConfig(entry.generatedConfiguration);
                      setPrompt(entry.prompt);
                      setRationale(entry.rationale || 'Restored from design history.');
                    }}
                    className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-[#2864A6] hover:bg-[#EAF2FB]/30 transition-colors"
                  >
                    <div className="text-xs font-semibold text-[#142B4A] line-clamp-2">
                      {entry.prompt}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 tabular-nums">
                      {new Date(entry.createdAt).toLocaleString()} ·{' '}
                      {entry.generatedConfiguration.layout.structure} ·{' '}
                      {entry.generatedConfiguration.typography.fontFamily}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Live Output Preview Column */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              <span className="font-bold text-[#142B4A]">Live Rendered Output:</span>{' '}
              {generatedConfig.layout.structure} · {generatedConfig.typography.fontFamily} ·{' '}
              {generatedConfig.colors.primary}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSaveForm(!showSaveForm)}
                className="px-3 py-1.5 text-xs font-semibold bg-[#EAF2FB] text-[#142B4A] hover:bg-[#dce9f9] rounded-lg inline-flex items-center gap-1"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span>Save Design</span>
              </button>
              <button
                type="button"
                onClick={handleApplyAndEdit}
                className="px-3.5 py-1.5 text-xs font-semibold bg-[#142B4A] text-white hover:bg-[#1e3d66] rounded-lg inline-flex items-center gap-1"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Apply & Open in Studio</span>
              </button>
            </div>
          </div>

          {showSaveForm && (
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Name this generated design..."
                className="flex-1 min-w-[180px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              />
              <button
                type="button"
                disabled={!customName.trim()}
                onClick={async () => {
                  await onSaveCustomDesign(customName.trim(), prompt.slice(0, 200), generatedConfig);
                  setCustomName('');
                  setShowSaveForm(false);
                  setSavedNotice('Design saved to your Custom Designs library');
                }}
                className="px-3.5 py-1.5 text-xs font-semibold bg-[#2864A6] text-white rounded-lg disabled:opacity-50"
              >
                Confirm Save
              </button>
            </div>
          )}

          {savedNotice && (
            <div className="px-5 py-2 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-800 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              <span>{savedNotice}</span>
            </div>
          )}

          <div className="bg-slate-100 p-6 flex justify-center overflow-auto max-h-[820px] studio-scroll">
            <CVRenderer cv={previewCV} design={generatedConfig} scale={0.72} />
          </div>
        </div>
      </div>
    </div>
  );
};
