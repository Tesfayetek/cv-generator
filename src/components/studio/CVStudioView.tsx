import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  BookmarkPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Loader2,
  Monitor,
  Printer,
  Redo2,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  COLOR_PRESETS,
  CV_FONT_OPTIONS,
  DEFAULT_DESIGN_CONFIG,
  DEFAULT_SECTION_ORDER,
  DEFAULT_SECTION_TITLES,
} from '../../data/presets';
import { analyzeATSReadiness, resolveEffectiveDesign } from '../../utils/atsChecker';
import {
  exportCombinedCVWithCoverDOCX,
  exportCombinedCVWithCoverPDF,
  exportCoverPageToDOCX,
  exportCoverPageToVectorPDF,
  exportToDOCX,
  exportToVectorPDF,
  triggerPrintCV,
} from '../../utils/exportCV';
import type {
  CVDocument,
  CVSectionKey,
  CVTemplate,
  DesignConfiguration,
} from '../../types/cv';
import type { CoverPageDocument } from '../../types/coverPage';
import { CVRenderer } from '../cv/CVRenderer';
import { CVContentEditor } from './CVContentEditor';

interface CVStudioViewProps {
  cv: CVDocument;
  templates: CVTemplate[];
  coverPages: CoverPageDocument[];
  aiEnabled: boolean;
  onSaveCV: (cv: CVDocument) => Promise<void>;
  onSaveCustomDesign: (name: string, description: string, config: DesignConfiguration) => Promise<void>;
  onOpenAIDesigner: () => void;
  onOpenCoverDesignerForCV: (cv: CVDocument) => void;
  onAttachCoverPage: (cvId: string, coverPageId: string) => Promise<void>;
}

type StudioTab = 'content' | 'design' | 'layout' | 'sections' | 'ai' | 'ats';

function parsePageSelection(spec: string, totalPages: number): number[] {
  const clean = spec.trim();
  if (!clean || clean.toLowerCase() === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const set = new Set<number>();
  for (const part of clean.split(',')) {
    const p = part.trim();
    if (p.includes('-')) {
      const [a, b] = p.split('-').map((n) => parseInt(n.trim(), 10));
      if (!isNaN(a) && !isNaN(b)) {
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) {
          if (i >= 1 && i <= totalPages) set.add(i);
        }
      }
    } else {
      const n = parseInt(p, 10);
      if (!isNaN(n) && n >= 1 && n <= totalPages) set.add(n);
    }
  }
  return set.size > 0 ? Array.from(set).sort((a, b) => a - b) : Array.from({ length: totalPages }, (_, i) => i + 1);
}

export const CVStudioView: React.FC<CVStudioViewProps> = ({
  cv: initialCV,
  templates,
  coverPages,
  aiEnabled,
  onSaveCV,
  onSaveCustomDesign,
  onOpenAIDesigner,
  onOpenCoverDesignerForCV,
  onAttachCoverPage,
}) => {
  const [history, setHistory] = useState<CVDocument[]>([initialCV]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const currentCV = history[historyIndex];

  const attachedCoverPage = useMemo(
    () =>
      coverPages.find(
        (cp) =>
          (currentCV.attachedCoverPageId && cp.coverPageId === currentCV.attachedCoverPageId) ||
          cp.cvId === currentCV.cvId
      ) || null,
    [coverPages, currentCV.attachedCoverPageId, currentCV.cvId]
  );

  useEffect(() => {
    setHistory([initialCV]);
    setHistoryIndex(0);
  }, [initialCV.cvId]);

  const [activeTab, setActiveTab] = useState<StudioTab>('content');
  const [mobilePanelOpen, setMobilePanelOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');

  // Preview Controls
  const [zoom, setZoom] = useState(0.76);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [totalPages, setTotalPages] = useState(1);
  const [activePage, setActivePage] = useState<number | undefined>(undefined); // undefined = All pages

  // Export Modal / Popover
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPageSize, setExportPageSize] = useState<'A4' | 'LETTER'>('A4');
  const [exportPageRange, setExportPageRange] = useState('all');
  const [exporting, setExporting] = useState(false);

  // Save Custom Design Modal
  const [saveDesignOpen, setSaveDesignOpen] = useState(false);
  const [customDesignName, setCustomDesignName] = useState('');
  const [customDesignDesc, setCustomDesignDesc] = useState('');

  // Drag & Drop sections
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // AI Assistant State
  const [aiAction, setAiAction] = useState<string>('improve_writing');
  const [aiTargetSection, setAiTargetSection] = useState<string>('summary');
  const [aiTargetExpId, setAiTargetExpId] = useState<string | undefined>(undefined);
  const [aiInputText, setAiInputText] = useState('');
  const [aiJobDescription, setAiJobDescription] = useState('');
  const [aiLengthPref, setAiLengthPref] = useState<'concise' | 'balanced' | 'detailed'>('balanced');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState<{
    updatedText: string;
    suggestedBullets: string[];
    suggestedSkills: string[];
    atsKeywords: string[];
    explanation: string;
    warnings: string[];
  } | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.templateId === currentCV.selectedTemplateId) || templates[0],
    [templates, currentCV.selectedTemplateId]
  );

  const templateBaseDesign: DesignConfiguration = useMemo(() => {
    if (!selectedTemplate) return DEFAULT_DESIGN_CONFIG;
    return {
      layout: selectedTemplate.layoutConfiguration,
      colors: selectedTemplate.colorConfiguration,
      typography: selectedTemplate.typographyConfiguration,
      page: selectedTemplate.previewConfiguration.page,
    };
  }, [selectedTemplate]);

  const activeDesign = currentCV.designOverrides || templateBaseDesign;
  const effectiveDesign = useMemo(
    () => resolveEffectiveDesign(activeDesign, currentCV),
    [activeDesign, currentCV]
  );

  const atsReport = useMemo(
    () => analyzeATSReadiness(currentCV, activeDesign),
    [currentCV, activeDesign]
  );

  const commitChange = useCallback(
    (updater: (prev: CVDocument) => CVDocument) => {
      setHistory((prevHist) => {
        const current = prevHist[historyIndex];
        const next = { ...updater(current), updatedAt: new Date().toISOString() };
        const sliced = prevHist.slice(0, historyIndex + 1);
        const updatedHist = [...sliced, next].slice(-40);
        setHistoryIndex(updatedHist.length - 1);
        return updatedHist;
      });
    },
    [historyIndex]
  );

  const updateDesign = (updater: (d: DesignConfiguration) => DesignConfiguration) => {
    commitChange((prev) => ({
      ...prev,
      designOverrides: updater(prev.designOverrides || templateBaseDesign),
    }));
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = () => {
    if (canUndo) setHistoryIndex((i) => i - 1);
  };

  const handleRedo = () => {
    if (canRedo) setHistoryIndex((i) => i + 1);
  };

  const handleResetDesign = () => {
    commitChange((prev) => ({
      ...prev,
      designOverrides: undefined,
      atsMode: false,
    }));
  };

  const handleSwitchTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.templateId === templateId);
    if (!tpl) return;
    commitChange((prev) => ({
      ...prev,
      selectedTemplateId: tpl.templateId,
      designOverrides: {
        layout: tpl.layoutConfiguration,
        colors: tpl.colorConfiguration,
        typography: tpl.typographyConfiguration,
        page: tpl.previewConfiguration.page,
      },
    }));
  };

  const handleSaveNow = async () => {
    setSaving(true);
    setSaveNotice('');
    try {
      await onSaveCV(currentCV);
      setSaveNotice('Saved');
      setTimeout(() => setSaveNotice(''), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleRunAI = async () => {
    setAiError('');
    setAiResult(null);
    setAiLoading(true);
    try {
      const resp = await fetch('/api/ai/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: aiAction,
          targetSection: aiTargetSection,
          inputText: aiInputText || currentCV.professionalSummary,
          jobDescription: aiJobDescription,
          lengthPreference: aiLengthPref,
          cvContext: {
            title: currentCV.personalInformation.professionalTitle,
            skills: currentCV.skills.map((s) => s.name),
            experienceCount: currentCV.workExperience.length,
            experienceSummary: currentCV.workExperience.map((w) => ({
              jobTitle: w.jobTitle,
              company: w.company,
              description: w.description,
              achievements: w.achievements,
            })),
            education: currentCV.education.map((e) => ({ degree: e.degree, institution: e.institution })),
          },
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'AI assistance request failed.');
      setAiResult(data);
    } catch (err: any) {
      setAiError(err?.message || 'Failed running AI assistant.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyAIResult = () => {
    if (!aiResult) return;
    commitChange((prev) => {
      if (aiTargetSection === 'summary') {
        return { ...prev, professionalSummary: aiResult.updatedText || prev.professionalSummary };
      }
      if (aiTargetSection === 'objective') {
        return { ...prev, careerObjective: aiResult.updatedText || prev.careerObjective };
      }
      if (aiTargetSection === 'experience' && aiTargetExpId) {
        return {
          ...prev,
          workExperience: prev.workExperience.map((w) =>
            w.id === aiTargetExpId
              ? {
                  ...w,
                  description: aiResult.updatedText || w.description,
                  achievements:
                    aiResult.suggestedBullets?.length > 0 ? aiResult.suggestedBullets : w.achievements,
                }
              : w
          ),
        };
      }
      if (aiTargetSection === 'skills' && aiResult.suggestedSkills?.length > 0) {
        const existingNames = new Set(prev.skills.map((s) => s.name.toLowerCase()));
        const additions = aiResult.suggestedSkills
          .filter((name) => !existingNames.has(name.toLowerCase()))
          .map((name, idx) => ({
            id: `sk_ai_${Date.now()}_${idx}`,
            name,
            category: 'AI Suggested',
            level: 4,
          }));
        return { ...prev, skills: [...prev.skills, ...additions] };
      }
      return { ...prev, professionalSummary: aiResult.updatedText || prev.professionalSummary };
    });
    setAiResult(null);
  };

  const selectedPrintPages = useMemo(
    () => parsePageSelection(exportPageRange, totalPages),
    [exportPageRange, totalPages]
  );

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      await exportToVectorPDF(currentCV, effectiveDesign, {
        pageSize: exportPageSize,
        selectedPages: selectedPrintPages,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportDOCX = async () => {
    setExporting(true);
    try {
      await exportToDOCX(currentCV, effectiveDesign, exportPageSize);
    } finally {
      setExporting(false);
    }
  };

  const moveSection = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= currentCV.sectionOrder.length) return;
    commitChange((prev) => {
      const next = [...prev.sectionOrder];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return { ...prev, sectionOrder: next };
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] overflow-hidden bg-slate-100">
      {/* Studio Top Toolbar */}
      <div className="no-print bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobilePanelOpen(!mobilePanelOpen)}
            className="lg:hidden px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-slate-50 text-slate-700 inline-flex items-center gap-1"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{mobilePanelOpen ? 'Preview' : 'Editor'}</span>
          </button>

          <input
            type="text"
            value={currentCV.cvTitle}
            onChange={(e) => commitChange((prev) => ({ ...prev, cvTitle: e.target.value }))}
            aria-label="CV document title"
            className="text-sm font-bold text-[#142B4A] bg-transparent border border-transparent hover:border-slate-300 focus:border-[#2864A6] focus:bg-white rounded-md px-2 py-1 min-w-[160px] max-w-[260px] truncate focus:outline-none"
          />

          <select
            value={currentCV.selectedTemplateId}
            onChange={(e) => handleSwitchTemplate(e.target.value)}
            aria-label="Switch CV template"
            className="hidden sm:block text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 max-w-[210px]"
          >
            {templates.map((t) => (
              <option key={t.templateId} value={t.templateId}>
                Template: {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo"
            className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-35 rounded-lg border border-slate-200"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo"
            className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-35 rounded-lg border border-slate-200"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleResetDesign}
            title="Reset Design to Template Default"
            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 inline-flex items-center gap-1 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Reset Design</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenCoverDesignerForCV(currentCV)}
            className="px-2.5 py-1.5 text-xs font-medium text-[#142B4A] bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 whitespace-nowrap"
            title="Design or Edit Cover Page for this CV"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden md:inline">
              {attachedCoverPage ? 'Edit Cover' : 'Cover Page'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSaveDesignOpen(true)}
            className="px-2.5 py-1.5 text-xs font-medium text-[#142B4A] bg-[#EAF2FB] hover:bg-[#dce9f9] rounded-lg inline-flex items-center gap-1 whitespace-nowrap"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Save Design</span>
          </button>
          <button
            type="button"
            onClick={handleSaveNow}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-[#2864A6] hover:bg-[#1f528b] rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : saveNotice || 'Save CV'}</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen(!exportOpen)}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#142B4A] hover:bg-[#1e3d66] rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            {exportOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-4 z-40 space-y-3">
                <div className="text-xs font-bold text-[#142B4A]">Export & Print Settings</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Paper Size</label>
                    <select
                      value={exportPageSize}
                      onChange={(e) => setExportPageSize(e.target.value as 'A4' | 'LETTER')}
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="A4">A4 (210 × 297 mm)</option>
                      <option value="LETTER">US Letter (8.5 × 11 in)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Pages (1–{totalPages})
                    </label>
                    <input
                      type="text"
                      value={exportPageRange}
                      onChange={(e) => setExportPageRange(e.target.value)}
                      placeholder="all or 1,2"
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                {/* Attach / Replace / Remove Cover Page */}
                <div className="pt-1 border-t border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                    <span>Attached Cover Page</span>
                    <button
                      type="button"
                      onClick={() => {
                        setExportOpen(false);
                        onOpenCoverDesignerForCV(currentCV);
                      }}
                      className="text-[#2864A6] hover:underline"
                    >
                      {attachedCoverPage ? 'Edit Cover' : '+ Create New'}
                    </button>
                  </div>
                  {coverPages.length > 0 && (
                    <select
                      value={attachedCoverPage?.coverPageId || ''}
                      onChange={async (e) => {
                        const cpId = e.target.value;
                        commitChange((prev) => ({ ...prev, attachedCoverPageId: cpId }));
                        await onAttachCoverPage(currentCV.cvId, cpId);
                      }}
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="">No cover page attached</option>
                      {coverPages.map((cp) => (
                        <option key={cp.coverPageId} value={cp.coverPageId}>
                          {cp.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-1.5 pt-1">
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={handleExportPDF}
                    className="w-full py-2 px-3 bg-[#142B4A] hover:bg-[#1e3d66] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Download CV Vector PDF</span>
                  </button>
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={handleExportDOCX}
                    className="w-full py-2 px-3 bg-[#EAF2FB] hover:bg-[#dce9f9] text-[#142B4A] text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CV Word (.docx)</span>
                  </button>

                  {attachedCoverPage && (
                    <>
                      <button
                        type="button"
                        disabled={exporting}
                        onClick={async () => {
                          setExporting(true);
                          try {
                            await exportCombinedCVWithCoverPDF(
                              attachedCoverPage,
                              currentCV,
                              effectiveDesign,
                              { pageSize: exportPageSize }
                            );
                          } finally {
                            setExporting(false);
                          }
                        }}
                        className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Download Complete CV + Cover PDF</span>
                      </button>
                      <button
                        type="button"
                        disabled={exporting}
                        onClick={async () => {
                          setExporting(true);
                          try {
                            await exportCombinedCVWithCoverDOCX(
                              attachedCoverPage,
                              currentCV,
                              effectiveDesign,
                              exportPageSize
                            );
                          } finally {
                            setExporting(false);
                          }
                        }}
                        className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Complete CV + Cover (.docx)</span>
                      </button>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          disabled={exporting}
                          onClick={async () => {
                            setExporting(true);
                            try {
                              await exportCoverPageToVectorPDF(attachedCoverPage, exportPageSize);
                            } finally {
                              setExporting(false);
                            }
                          }}
                          className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg"
                        >
                          Cover PDF Only
                        </button>
                        <button
                          type="button"
                          disabled={exporting}
                          onClick={async () => {
                            setExporting(true);
                            try {
                              await exportCoverPageToDOCX(attachedCoverPage, exportPageSize);
                            } finally {
                              setExporting(false);
                            }
                          }}
                          className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg"
                        >
                          Cover DOCX Only
                        </button>
                      </div>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setExportOpen(false);
                      setTimeout(() => triggerPrintCV(exportPageSize), 100);
                    }}
                    className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print CV (Selected Pages)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* LEFT PANEL: DESIGN & CONTENT CONTROLS */}
        <aside
          className={`no-print bg-white border-r border-slate-200 flex flex-col w-full lg:w-[440px] xl:w-[480px] shrink-0 ${
            mobilePanelOpen ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Control Tabs */}
          <div className="grid grid-cols-6 border-b border-slate-200 bg-slate-50/70">
            {(
              [
                { id: 'content', label: 'Content' },
                { id: 'design', label: 'Design' },
                { id: 'layout', label: 'Layout' },
                { id: 'sections', label: 'Sections' },
                { id: 'ai', label: 'AI Write' },
                { id: 'ats', label: 'ATS' },
              ] as Array<{ id: StudioTab; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-2.5 px-1 text-[11px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-[#142B4A] text-[#142B4A] bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 studio-scroll">
            {/* TAB 1: CONTENT */}
            {activeTab === 'content' && (
              <CVContentEditor
                cv={currentCV}
                onChange={commitChange}
                onRequestAIForSection={(section, text, expId) => {
                  setAiTargetSection(section);
                  setAiInputText(text);
                  setAiTargetExpId(expId);
                  setAiAction(
                    section === 'experience'
                      ? 'generate_achievements'
                      : section === 'skills'
                      ? 'organize_skills'
                      : section === 'objective'
                      ? 'generate_objective'
                      : 'improve_writing'
                  );
                  setActiveTab('ai');
                }}
              />
            )}

            {/* TAB 2: DESIGN (Colors, Fonts, Typography, Heading & Visual Styles) */}
            {activeTab === 'design' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between bg-[#EAF2FB]/70 border border-[#2864A6]/20 rounded-xl p-3">
                  <div className="text-xs text-[#142B4A]">
                    <span className="font-bold block">Want AI to style your CV?</span>
                    <span className="text-slate-600">Describe any theme in natural language.</span>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenAIDesigner}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#142B4A] text-white rounded-lg inline-flex items-center gap-1 shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Designer</span>
                  </button>
                </div>

                {/* Color Presets */}
                <div>
                  <label className="block text-xs font-bold text-[#142B4A] mb-2">Color Themes</label>
                  <div className="grid grid-cols-3 gap-2">
                    {COLOR_PRESETS.map((preset) => {
                      const active = activeDesign.colors.primary === preset.primary;
                      return (
                        <button
                          key={preset.presetName}
                          type="button"
                          onClick={() => updateDesign((d) => ({ ...d, colors: preset }))}
                          className={`p-2 rounded-lg border text-left transition-colors ${
                            active ? 'border-[#142B4A] bg-[#EAF2FB]/50' : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/10"
                              style={{ backgroundColor: preset.primary }}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/10"
                              style={{ backgroundColor: preset.secondary }}
                            />
                          </div>
                          <div className="text-[11px] font-semibold text-slate-700 truncate">
                            {preset.presetName}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Color Pickers */}
                <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
                  {[
                    { key: 'primary', label: 'Primary' },
                    { key: 'secondary', label: 'Secondary' },
                    { key: 'accent', label: 'Accent Fill' },
                    { key: 'headerBg', label: 'Header Bg' },
                    { key: 'sidebarBg', label: 'Sidebar Bg' },
                    { key: 'text', label: 'Body Ink' },
                  ].map((item) => (
                    <label key={item.key} className="block text-[11px] font-semibold text-slate-600">
                      <span className="block mb-1">{item.label}</span>
                      <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2 py-1 bg-white">
                        <input
                          type="color"
                          value={(activeDesign.colors as any)[item.key]}
                          onChange={(e) =>
                            updateDesign((d) => ({
                              ...d,
                              colors: { ...d.colors, presetName: 'Custom', [item.key]: e.target.value },
                            }))
                          }
                          className="w-5 h-5 border-0 p-0 bg-transparent cursor-pointer"
                        />
                        <span className="text-[10px] font-mono text-slate-500">
                          {(activeDesign.colors as any)[item.key]}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Typography */}
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-[#142B4A]">Typography</div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Body Font</label>
                      <select
                        value={activeDesign.typography.fontFamily}
                        onChange={(e) =>
                          updateDesign((d) => ({
                            ...d,
                            typography: { ...d.typography, fontFamily: e.target.value as any },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        {CV_FONT_OPTIONS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Heading Font</label>
                      <select
                        value={activeDesign.typography.headingFontFamily}
                        onChange={(e) =>
                          updateDesign((d) => ({
                            ...d,
                            typography: { ...d.typography, headingFontFamily: e.target.value as any },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        {CV_FONT_OPTIONS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Name Size</span>
                        <span className="tabular-nums">{activeDesign.typography.nameSize}px</span>
                      </div>
                      <input
                        type="range"
                        min={20}
                        max={34}
                        step={1}
                        value={activeDesign.typography.nameSize}
                        onChange={(e) =>
                          updateDesign((d) => ({
                            ...d,
                            typography: { ...d.typography, nameSize: Number(e.target.value) },
                          }))
                        }
                        className="w-full accent-[#142B4A]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Heading Size</span>
                        <span className="tabular-nums">{activeDesign.typography.headingSize}px</span>
                      </div>
                      <input
                        type="range"
                        min={10.5}
                        max={16}
                        step={0.5}
                        value={activeDesign.typography.headingSize}
                        onChange={(e) =>
                          updateDesign((d) => ({
                            ...d,
                            typography: { ...d.typography, headingSize: Number(e.target.value) },
                          }))
                        }
                        className="w-full accent-[#142B4A]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Body Size</span>
                        <span className="tabular-nums">{activeDesign.typography.bodySize}px</span>
                      </div>
                      <input
                        type="range"
                        min={8.5}
                        max={12.5}
                        step={0.5}
                        value={activeDesign.typography.bodySize}
                        onChange={(e) =>
                          updateDesign((d) => ({
                            ...d,
                            typography: { ...d.typography, bodySize: Number(e.target.value) },
                          }))
                        }
                        className="w-full accent-[#142B4A]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Line Spacing</span>
                        <span className="tabular-nums">{activeDesign.typography.lineHeight}</span>
                      </div>
                      <input
                        type="range"
                        min={1.2}
                        max={1.75}
                        step={0.05}
                        value={activeDesign.typography.lineHeight}
                        onChange={(e) =>
                          updateDesign((d) => ({
                            ...d,
                            typography: { ...d.typography, lineHeight: Number(e.target.value) },
                          }))
                        }
                        className="w-full accent-[#142B4A]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Font Weight</label>
                      <select
                        value={activeDesign.typography.fontWeight}
                        onChange={(e) =>
                          updateDesign((d) => ({
                            ...d,
                            typography: { ...d.typography, fontWeight: e.target.value as any },
                          }))
                        }
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="400">Regular (400)</option>
                        <option value="500">Medium (500)</option>
                        <option value="600">SemiBold (600)</option>
                      </select>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Letter Spacing</span>
                        <span className="tabular-nums">{activeDesign.typography.letterSpacing}em</span>
                      </div>
                      <input
                        type="range"
                        min={-0.02}
                        max={0.08}
                        step={0.01}
                        value={activeDesign.typography.letterSpacing}
                        onChange={(e) =>
                          updateDesign((d) => ({
                            ...d,
                            typography: { ...d.typography, letterSpacing: Number(e.target.value) },
                          }))
                        }
                        className="w-full accent-[#142B4A]"
                      />
                    </div>
                  </div>
                </div>

                {/* Section & Visual Styling */}
                <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Section Heading Style</label>
                    <select
                      value={activeDesign.layout.sectionHeadingStyle}
                      onChange={(e) =>
                        updateDesign((d) => ({
                          ...d,
                          layout: { ...d.layout, sectionHeadingStyle: e.target.value as any },
                        }))
                      }
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="underline">Underline</option>
                      <option value="caps-rule">Caps + Line</option>
                      <option value="left-bar">Left Accent Bar</option>
                      <option value="shaded-band">Shaded Band</option>
                      <option value="double-rule">Double Rule</option>
                      <option value="numbered">Numbered (01.)</option>
                      <option value="clean-bold">Clean Bold</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Skill Display</label>
                    <select
                      value={activeDesign.layout.skillDisplay}
                      onChange={(e) =>
                        updateDesign((d) => ({
                          ...d,
                          layout: { ...d.layout, skillDisplay: e.target.value as any },
                        }))
                      }
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="tags">Skill Tags</option>
                      <option value="bars">Proficiency Bars</option>
                      <option value="grid">Two-Column Grid</option>
                      <option value="grouped">Grouped by Category</option>
                      <option value="comma">Inline Comma List</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bullet Style</label>
                    <select
                      value={activeDesign.layout.bulletStyle}
                      onChange={(e) =>
                        updateDesign((d) => ({
                          ...d,
                          layout: { ...d.layout, bulletStyle: e.target.value as any },
                        }))
                      }
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="disc">Round Bullet (•)</option>
                      <option value="square">Square (▪)</option>
                      <option value="arrow">Arrow (▸)</option>
                      <option value="dash">Dash (–)</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Timeline Style</label>
                    <select
                      value={activeDesign.layout.timelineStyle}
                      onChange={(e) =>
                        updateDesign((d) => ({
                          ...d,
                          layout: { ...d.layout, timelineStyle: e.target.value as any },
                        }))
                      }
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="none">Standard Inline</option>
                      <option value="dates-left">Dates Left Column</option>
                      <option value="dots">Vertical Timeline</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: LAYOUT & PAGE */}
            {activeTab === 'layout' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#142B4A] mb-2">Column Structure</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'one-column', label: 'One-Column' },
                      { id: 'two-column-balanced', label: 'Two-Column Split' },
                      { id: 'sidebar-left', label: 'Sidebar Left' },
                      { id: 'sidebar-right', label: 'Sidebar Right' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          updateDesign((d) => ({
                            ...d,
                            layout: { ...d.layout, structure: opt.id as any },
                          }))
                        }
                        className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                          activeDesign.layout.structure === opt.id
                            ? 'bg-[#142B4A] text-white border-[#142B4A]'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {activeDesign.layout.structure !== 'one-column' && (
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                      <span>Sidebar Width</span>
                      <span className="tabular-nums">{activeDesign.layout.sidebarWidth}%</span>
                    </div>
                    <input
                      type="range"
                      min={26}
                      max={42}
                      value={activeDesign.layout.sidebarWidth}
                      onChange={(e) =>
                        updateDesign((d) => ({
                          ...d,
                          layout: { ...d.layout, sidebarWidth: Number(e.target.value) },
                        }))
                      }
                      className="w-full accent-[#142B4A]"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Header Style</label>
                    <select
                      value={activeDesign.layout.headerStyle}
                      onChange={(e) =>
                        updateDesign((d) => ({
                          ...d,
                          layout: { ...d.layout, headerStyle: e.target.value as any },
                        }))
                      }
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="left-aligned">Left Aligned</option>
                      <option value="centered">Centered Classic</option>
                      <option value="banner-colored">Colored Banner</option>
                      <option value="split-contact">Split Name / Contact</option>
                      <option value="executive-rule">Executive Heavy Rule</option>
                      <option value="minimal">Minimal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Decorative Accent</label>
                    <select
                      value={activeDesign.layout.decorativeAccent}
                      onChange={(e) =>
                        updateDesign((d) => ({
                          ...d,
                          layout: { ...d.layout, decorativeAccent: e.target.value as any },
                        }))
                      }
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="none">None</option>
                      <option value="top-stripe">Top Accent Stripe</option>
                      <option value="corner-mark">Corner Frame</option>
                      <option value="sidebar-border">Sidebar Edge Line</option>
                      <option value="footer-rule">Accent Footer Rule</option>
                    </select>
                  </div>
                </div>

                {/* Photo Settings */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={activeDesign.layout.showPhoto}
                      onChange={(e) =>
                        updateDesign((d) => ({
                          ...d,
                          layout: { ...d.layout, showPhoto: e.target.checked },
                        }))
                      }
                    />
                    <span>Show Profile Photo</span>
                  </label>
                  {activeDesign.layout.showPhoto && (
                    <select
                      value={activeDesign.layout.photoShape}
                      onChange={(e) =>
                        updateDesign((d) => ({
                          ...d,
                          layout: { ...d.layout, photoShape: e.target.value as any },
                        }))
                      }
                      className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="circle">Circle</option>
                      <option value="rounded">Rounded</option>
                      <option value="square">Square</option>
                    </select>
                  )}
                </div>

                {/* Page Configuration */}
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-[#142B4A]">Page & Margins</div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Page Size</label>
                      <select
                        value={activeDesign.page.size}
                        onChange={(e) =>
                          updateDesign((d) => ({
                            ...d,
                            page: { ...d.page, size: e.target.value as 'A4' | 'LETTER' },
                          }))
                        }
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="A4">A4 (International)</option>
                        <option value="LETTER">US Letter</option>
                      </select>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Section Spacing</span>
                        <span className="tabular-nums">{activeDesign.page.sectionSpacing}px</span>
                      </div>
                      <input
                        type="range"
                        min={8}
                        max={26}
                        value={activeDesign.page.sectionSpacing}
                        onChange={(e) =>
                          updateDesign((d) => ({
                            ...d,
                            page: { ...d.page, sectionSpacing: Number(e.target.value) },
                          }))
                        }
                        className="w-full accent-[#142B4A]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        { key: 'marginTop', label: 'Top Margin' },
                        { key: 'marginBottom', label: 'Bottom Margin' },
                        { key: 'marginLeft', label: 'Left Margin' },
                        { key: 'marginRight', label: 'Right Margin' },
                      ] as const
                    ).map((m) => (
                      <div key={m.key}>
                        <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                          <span>{m.label}</span>
                          <span className="tabular-nums">{activeDesign.page[m.key]}mm</span>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={25}
                          value={activeDesign.page[m.key]}
                          onChange={(e) =>
                            updateDesign((d) => ({
                              ...d,
                              page: { ...d.page, [m.key]: Number(e.target.value) },
                            }))
                          }
                          className="w-full accent-[#142B4A]"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <input
                      type="text"
                      value={activeDesign.layout.headerText || ''}
                      onChange={(e) =>
                        updateDesign((d) => ({
                          ...d,
                          layout: { ...d.layout, headerText: e.target.value },
                        }))
                      }
                      placeholder="Page 2+ Header Text"
                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                    <input
                      type="text"
                      value={activeDesign.layout.footerText || ''}
                      onChange={(e) =>
                        updateDesign((d) => ({
                          ...d,
                          layout: { ...d.layout, footerText: e.target.value },
                        }))
                      }
                      placeholder="Custom Footer Text"
                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={activeDesign.layout.showPageNumbers}
                      onChange={(e) =>
                        updateDesign((d) => ({
                          ...d,
                          layout: { ...d.layout, showPageNumbers: e.target.checked },
                        }))
                      }
                    />
                    <span>Show Page Numbers (Page X of Y)</span>
                  </label>
                </div>
              </div>
            )}

            {/* TAB 4: SECTIONS (Reorder, Rename, Hide/Show, Sidebar Placement, Page Breaks) */}
            {activeTab === 'sections' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Drag and drop sections (or use arrows) to reorder, rename section titles, toggle visibility, or force a page break before a section.
                </p>
                <div className="space-y-2">
                  {currentCV.sectionOrder.map((secKey, idx) => {
                    const isHidden = currentCV.hiddenSections.includes(secKey);
                    const hasBreak = activeDesign.page.explicitPageBreaks?.includes(secKey);
                    const inSidebar = activeDesign.layout.sidebarSections?.includes(secKey);

                    return (
                      <div
                        key={secKey}
                        draggable
                        onDragStart={() => setDragIndex(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (dragIndex !== null && dragIndex !== idx) {
                            moveSection(dragIndex, idx);
                          }
                          setDragIndex(null);
                        }}
                        className={`p-2.5 border rounded-xl bg-white flex flex-col gap-2 ${
                          isHidden ? 'opacity-60 border-slate-200 bg-slate-50' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-4 h-4 text-slate-400 cursor-grab shrink-0" />
                          <input
                            type="text"
                            value={currentCV.sectionTitles[secKey] || DEFAULT_SECTION_TITLES[secKey]}
                            onChange={(e) =>
                              commitChange((prev) => ({
                                ...prev,
                                sectionTitles: { ...prev.sectionTitles, [secKey]: e.target.value },
                              }))
                            }
                            className="flex-1 px-2 py-1 text-xs font-semibold text-[#142B4A] border border-slate-200 rounded"
                          />
                          <button
                            type="button"
                            onClick={() => moveSection(idx, idx - 1)}
                            disabled={idx === 0}
                            className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                            title="Move up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSection(idx, idx + 1)}
                            disabled={idx === currentCV.sectionOrder.length - 1}
                            className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                            title="Move down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              commitChange((prev) => ({
                                ...prev,
                                hiddenSections: isHidden
                                  ? prev.hiddenSections.filter((s) => s !== secKey)
                                  : [...prev.hiddenSections, secKey],
                              }))
                            }
                            className="p-1 text-slate-500 hover:text-[#142B4A]"
                            title={isHidden ? 'Show section' : 'Hide section'}
                          >
                            {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        <div className="flex items-center gap-4 pl-6 text-[11px] text-slate-600">
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={Boolean(hasBreak)}
                              onChange={(e) => {
                                const currentBreaks = activeDesign.page.explicitPageBreaks || [];
                                const nextBreaks = e.target.checked
                                  ? [...currentBreaks, secKey]
                                  : currentBreaks.filter((b) => b !== secKey);
                                updateDesign((d) => ({
                                  ...d,
                                  page: { ...d.page, explicitPageBreaks: nextBreaks },
                                }));
                              }}
                            />
                            <span>Page break before</span>
                          </label>
                          {activeDesign.layout.structure !== 'one-column' && (
                            <label className="inline-flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={Boolean(inSidebar)}
                                onChange={(e) => {
                                  const currSide = activeDesign.layout.sidebarSections || [];
                                  const nextSide = e.target.checked
                                    ? [...currSide, secKey]
                                    : currSide.filter((s) => s !== secKey);
                                  updateDesign((d) => ({
                                    ...d,
                                    layout: { ...d.layout, sidebarSections: nextSide },
                                  }));
                                }}
                              />
                              <span>Place in sidebar</span>
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 5: AI CONTENT ASSISTANT */}
            {activeTab === 'ai' && (
              <div className="space-y-3.5">
                {!aiEnabled && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    AI generation is currently disabled in Administrator Settings.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Target Section</label>
                    <select
                      value={aiTargetSection}
                      onChange={(e) => setAiTargetSection(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="summary">Professional Summary</option>
                      <option value="objective">Career Objective</option>
                      <option value="experience">Work Experience</option>
                      <option value="skills">Skills & Keywords</option>
                      <option value="education">Education & Training</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Length Style</label>
                    <select
                      value={aiLengthPref}
                      onChange={(e) => setAiLengthPref(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="concise">Concise</option>
                      <option value="balanced">Balanced</option>
                      <option value="detailed">Detailed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">AI Action</label>
                  <select
                    value={aiAction}
                    onChange={(e) => setAiAction(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="improve_writing">Improve Writing & Grammar</option>
                    <option value="rewrite_professional">Rewrite Professionally</option>
                    <option value="make_concise">Make More Concise</option>
                    <option value="make_detailed">Make More Detailed</option>
                    <option value="generate_achievements">Generate Achievement Bullets</option>
                    <option value="generate_summary">Generate Executive Summary</option>
                    <option value="generate_objective">Generate Career Objective</option>
                    <option value="organize_skills">Identify & Organize Skills</option>
                    <option value="match_job_description">Match Job Description</option>
                    <option value="improve_ats">Improve ATS Compatibility</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Source Text / Notes (AI will not invent employers or dates)
                  </label>
                  <textarea
                    rows={4}
                    value={aiInputText}
                    onChange={(e) => setAiInputText(e.target.value)}
                    placeholder="Paste or edit text to improve, or leave blank to use your current CV context..."
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Target Job Description (Optional — for keyword matching)
                  </label>
                  <textarea
                    rows={3}
                    value={aiJobDescription}
                    onChange={(e) => setAiJobDescription(e.target.value)}
                    placeholder="Paste vacancy announcement requirements here..."
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>

                <button
                  type="button"
                  disabled={aiLoading || !aiEnabled}
                  onClick={handleRunAI}
                  className="w-full py-2.5 bg-[#2864A6] hover:bg-[#1f528b] disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                >
                  {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>{aiLoading ? 'Generating Suggestion...' : 'Generate AI Suggestion'}</span>
                </button>

                {aiError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between gap-2">
                    <span>{aiError}</span>
                    <button type="button" onClick={handleRunAI} className="font-semibold underline shrink-0">
                      Retry
                    </button>
                  </div>
                )}

                {aiResult && (
                  <div className="border border-[#2864A6]/30 bg-[#EAF2FB]/40 rounded-xl p-3.5 space-y-3">
                    <div className="text-xs font-bold text-[#142B4A]">
                      Review Suggestion Before Applying
                    </div>
                    {aiResult.updatedText && (
                      <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 whitespace-pre-line">
                        {aiResult.updatedText}
                      </div>
                    )}
                    {aiResult.suggestedBullets?.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs space-y-1">
                        <div className="font-semibold text-slate-600">Suggested Bullet Points:</div>
                        <ul className="list-disc pl-4 space-y-1">
                          {aiResult.suggestedBullets.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiResult.suggestedSkills?.length > 0 && (
                      <div className="text-xs text-slate-700">
                        <span className="font-semibold">Suggested Skills: </span>
                        {aiResult.suggestedSkills.join(', ')}
                      </div>
                    )}
                    {aiResult.atsKeywords?.length > 0 && (
                      <div className="text-xs text-slate-700">
                        <span className="font-semibold">ATS Keywords Found: </span>
                        {aiResult.atsKeywords.join(', ')}
                      </div>
                    )}
                    {aiResult.explanation && (
                      <p className="text-[11px] text-slate-600">{aiResult.explanation}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleApplyAIResult}
                        className="flex-1 py-2 bg-[#142B4A] hover:bg-[#1e3d66] text-white text-xs font-semibold rounded-lg"
                      >
                        Approve & Apply to CV
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiResult(null)}
                        className="px-3 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: ATS READINESS */}
            {activeTab === 'ats' && (
              <div className="space-y-4">
                <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-[#142B4A] flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#2864A6]" />
                      <span>ATS-Friendly Structural Mode</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Forces single-column linear reading order, hides decorative graphics/photos, and converts skill bars to parseable text.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={currentCV.atsMode}
                    onChange={(e) => commitChange((prev) => ({ ...prev, atsMode: e.target.checked }))}
                    className="mt-1 h-4 w-4 accent-[#142B4A]"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#142B4A]">ATS Readiness Checklist</div>
                  {atsReport.items.map((item) => (
                    <div key={item.id} className="p-3 border border-slate-200 rounded-xl bg-white space-y-1">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                        {item.status === 'pass' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                        <span>{item.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed pl-6">{item.detail}</p>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {atsReport.summaryNote}
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT PANEL: LIVE MULTI-PAGE CV PREVIEW */}
        <section
          className={`flex-1 flex flex-col min-w-0 bg-slate-100 ${
            mobilePanelOpen ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Preview Controls Bar */}
          <div className="no-print bg-white/90 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1 ${
                    previewDevice === 'desktop' ? 'bg-white text-[#142B4A] shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1 ${
                    previewDevice === 'mobile' ? 'bg-white text-[#142B4A] shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile</span>
                </button>
              </div>

              <span className="text-xs text-slate-500 hidden sm:inline">
                {effectiveDesign.page.size} · {effectiveDesign.typography.fontFamily}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Page Navigation */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setActivePage(undefined)}
                  className={`px-2 py-1 text-xs font-semibold rounded-md ${
                    activePage === undefined ? 'bg-white text-[#142B4A] shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  All ({totalPages})
                </button>
                <button
                  type="button"
                  onClick={() => setActivePage((p) => (p ? Math.max(1, p - 1) : 1))}
                  disabled={activePage === 1}
                  className="p-1 text-slate-600 disabled:opacity-35"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-semibold tabular-nums px-1 text-slate-700">
                  {activePage ? `Pg ${activePage}/${totalPages}` : `${totalPages} pg`}
                </span>
                <button
                  type="button"
                  onClick={() => setActivePage((p) => (p ? Math.min(totalPages, p + 1) : 1))}
                  disabled={activePage === totalPages}
                  className="p-1 text-slate-600 disabled:opacity-35"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Zoom */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
                  className="p-1.5 text-slate-600 hover:bg-slate-200/70 rounded"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-semibold tabular-nums w-10 text-center text-slate-700">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(1.25, Number((z + 0.1).toFixed(2))))}
                  className="p-1.5 text-slate-600 hover:bg-slate-200/70 rounded"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable Paper Stage */}
          <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start studio-scroll">
            <div
              className={
                previewDevice === 'mobile'
                  ? 'max-w-[380px] w-full bg-slate-200/70 p-3 rounded-2xl border border-slate-300 overflow-x-auto'
                  : 'w-full flex justify-center'
              }
            >
              <CVRenderer
                cv={currentCV}
                design={effectiveDesign}
                scale={previewDevice === 'mobile' ? Math.min(0.42, zoom) : zoom}
                activePage={activePage}
                selectedPrintPages={selectedPrintPages}
                onPageCountChange={(cnt) => {
                  setTotalPages(cnt);
                  if (activePage && activePage > cnt) setActivePage(cnt);
                }}
              />
            </div>
          </div>
        </section>
      </div>

      {/* Save as Custom Design Modal */}
      {saveDesignOpen && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#142B4A]">Save Custom Design Template</h3>
            <p className="text-xs text-slate-500">
              Save your current typography, colors, margins, and column structure to apply across multiple CVs.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Design Name *</label>
              <input
                type="text"
                value={customDesignName}
                onChange={(e) => setCustomDesignName(e.target.value)}
                placeholder="e.g., My Executive Navy Layout"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <textarea
                rows={2}
                value={customDesignDesc}
                onChange={(e) => setCustomDesignDesc(e.target.value)}
                placeholder="Notes on style, colors, or target industry..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSaveDesignOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!customDesignName.trim()}
                onClick={async () => {
                  await onSaveCustomDesign(
                    customDesignName.trim(),
                    customDesignDesc.trim(),
                    activeDesign
                  );
                  setCustomDesignName('');
                  setCustomDesignDesc('');
                  setSaveDesignOpen(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#142B4A] disabled:opacity-50 rounded-lg"
              >
                Save Design
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
