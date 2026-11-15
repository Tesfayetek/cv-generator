import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FilePlus2,
  FileText,
  ImagePlus,
  Layers,
  Link2,
  Loader2,
  Lock,
  Palette,
  Plus,
  Printer,
  Redo2,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type as TypeIcon,
  Undo2,
  Unlock,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  COVER_COLOR_SCHEMES,
  COVER_PAGE_CATEGORIES,
  COVER_PAGE_FONT_OPTIONS,
  createCoverPageFromTemplate,
  createCoverPersonalInfoFromCV,
  STARTER_COVER_PAGE_TEMPLATES,
} from '../../data/coverPageTemplates';
import { DEFAULT_DESIGN_CONFIG } from '../../data/presets';
import {
  exportCombinedCVWithCoverDOCX,
  exportCombinedCVWithCoverPDF,
  exportCoverPageToDOCX,
  exportCoverPageToVectorPDF,
  triggerPrintCV,
} from '../../utils/exportCV';
import type { CVDocument, CVTemplate, DesignConfiguration } from '../../types/cv';
import type {
  CoverBackgroundType,
  CoverCanvasElement,
  CoverPageCategory,
  CoverPageDocument,
  CoverPageFontFamily,
  CoverPagePersonalInfo,
  CoverPageSize,
  CoverPageTemplate,
  CoverPatternType,
} from '../../types/coverPage';
import { CVRenderer } from '../cv/CVRenderer';
import { CoverPageRenderer } from './CoverPageRenderer';
import { ImageCropperModal } from './ImageCropperModal';

interface CoverPageDesignerViewProps {
  userId: string;
  coverPages: CoverPageDocument[];
  activeCoverPageId: string | null;
  onSelectCoverPageId: (id: string) => void;
  coverPageTemplates: CoverPageTemplate[];
  cvs: CVDocument[];
  cvTemplates: CVTemplate[];
  aiEnabled: boolean;
  onSaveCoverPage: (cp: CoverPageDocument, isNew?: boolean) => Promise<void>;
  onDeleteCoverPage: (id: string) => Promise<void>;
  onAttachToCV: (cvId: string, coverPageId: string) => Promise<void>;
}

type LeftTab = 'templates' | 'text' | 'images' | 'design' | 'layers' | 'ai';

const AI_STARTER_PROMPTS = [
  'Design an executive navy blue cover page with white typography, subtle geometric background, and space for a portrait photo.',
  'Create an international NGO professional cover page for a Programme Director with teal and navy accents and target organization field.',
  'Minimalist black and gold luxury leadership cover page using Playfair Display serif typography and subtle gold border frame.',
  'Clean Swiss academic researcher dossier cover page on warm ivory background with Garamond headings and research abstract card.',
  'Modern digital specialist portfolio cover page with dark charcoal-to-cobalt gradient, grid motif, and crisp sans-serif hierarchy.',
  'Contemporary executive consultant cover page with left vertical navy spine, ice blue summary card, and circular portrait frame.',
];

const AI_REFINEMENT_CHIPS = [
  'Make the background darker navy blue',
  'Move the name to the upper left',
  'Switch headings to Playfair Display serif',
  'Add a circular portrait frame on the top right',
  'Use a crisp white minimalist layout with navy footer band',
];

export const CoverPageDesignerView: React.FC<CoverPageDesignerViewProps> = ({
  userId,
  coverPages,
  activeCoverPageId,
  onSelectCoverPageId,
  coverPageTemplates,
  cvs,
  cvTemplates,
  aiEnabled,
  onSaveCoverPage,
  onDeleteCoverPage,
  onAttachToCV,
}) => {
  const activeSaved = useMemo(
    () => coverPages.find((c) => c.coverPageId === activeCoverPageId) || coverPages[0] || null,
    [coverPages, activeCoverPageId]
  );

  // Fallback transient working document if user hasn't created a saved cover page yet
  const [draft, setDraft] = useState<CoverPageDocument>(() =>
    activeSaved ||
    createCoverPageFromTemplate(
      userId,
      coverPageTemplates[0] || STARTER_COVER_PAGE_TEMPLATES[0],
      cvs[0] || null
    )
  );

  const [history, setHistory] = useState<CoverPageDocument[]>([draft]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const current = history[historyIdx] || draft;

  useEffect(() => {
    if (activeSaved) {
      setDraft(activeSaved);
      setHistory([activeSaved]);
      setHistoryIdx(0);
    }
  }, [activeSaved?.coverPageId]);

  const [leftTab, setLeftTab] = useState<LeftTab>('templates');
  const [mobilePanelOpen, setMobilePanelOpen] = useState(true);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.58);
  const [previewWithCV, setPreviewWithCV] = useState(false);

  // Filters for 25+ templates tab
  const [tplSearch, setTplSearch] = useState('');
  const [tplCategory, setTplCategory] = useState<CoverPageCategory | 'All'>('All');

  // Save & Export UI states
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportPageSize, setExportPageSize] = useState<'A4' | 'LETTER'>('A4');

  // Image Cropper Modal state
  const [cropModal, setCropModal] = useState<{
    assetKey: 'profilePhoto' | 'personalLogo' | 'companyLogo' | 'backgroundImage';
    title: string;
    elementId?: string;
  } | null>(null);

  // AI Studio state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiHistory, setAiHistory] = useState<Array<{ prompt: string; rationale: string }>>([]);

  const commitChange = useCallback(
    (updater: (prev: CoverPageDocument) => CoverPageDocument) => {
      setHistory((prevHist) => {
        const base = prevHist[historyIdx] || draft;
        const next = { ...updater(base), updatedAt: new Date().toISOString() };
        const sliced = prevHist.slice(0, historyIdx + 1);
        const updated = [...sliced, next].slice(-35);
        setHistoryIdx(updated.length - 1);
        setDraft(next);
        return updated;
      });
    },
    [historyIdx, draft]
  );

  // Smooth live drag update without pushing 60 undo entries/sec; history committed on pointerup
  const liveUpdateElement = useCallback(
    (elId: string, patch: Partial<CoverCanvasElement>) => {
      setHistory((prevHist) => {
        const copy = [...prevHist];
        const curr = copy[historyIdx];
        if (!curr) return prevHist;
        copy[historyIdx] = {
          ...curr,
          designConfiguration: {
            ...curr.designConfiguration,
            elements: curr.designConfiguration.elements.map((e) =>
              e.id === elId ? { ...e, ...patch } : e
            ),
          },
        };
        return copy;
      });
    },
    [historyIdx]
  );

  const commitElementPatch = useCallback(
    (elId: string, patch: Partial<CoverCanvasElement>) => {
      commitChange((prev) => ({
        ...prev,
        designConfiguration: {
          ...prev.designConfiguration,
          elements: prev.designConfiguration.elements.map((e) =>
            e.id === elId ? { ...e, ...patch } : e
          ),
        },
      }));
    },
    [commitChange]
  );

  const selectedElement = useMemo(
    () =>
      current.designConfiguration.elements.find((e) => e.id === selectedElementId) || null,
    [current.designConfiguration.elements, selectedElementId]
  );

  const linkedCV = useMemo(
    () => cvs.find((c) => c.cvId === current.cvId) || cvs[0] || null,
    [cvs, current.cvId]
  );

  const resolvedLinkedCVDesign: DesignConfiguration = useMemo(() => {
    if (!linkedCV) return DEFAULT_DESIGN_CONFIG;
    if (linkedCV.designOverrides) return linkedCV.designOverrides;
    const tpl = cvTemplates.find((t) => t.templateId === linkedCV.selectedTemplateId);
    if (!tpl) return DEFAULT_DESIGN_CONFIG;
    return {
      layout: tpl.layoutConfiguration,
      colors: tpl.colorConfiguration,
      typography: tpl.typographyConfiguration,
      page: tpl.previewConfiguration.page,
    };
  }, [linkedCV, cvTemplates]);

  const filteredTemplates = useMemo(() => {
    const q = tplSearch.trim().toLowerCase();
    return coverPageTemplates.filter((t) => {
      if (t.status === 'archived') return false;
      const catMatch = tplCategory === 'All' || t.category === tplCategory;
      const qMatch =
        !q ||
        t.templateName.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q);
      return catMatch && qMatch;
    });
  }, [coverPageTemplates, tplCategory, tplSearch]);

  const showTempNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3000);
  };

  const handleSaveNow = async () => {
    setSaving(true);
    try {
      const isNew = !coverPages.some((c) => c.coverPageId === current.coverPageId);
      await onSaveCoverPage(current, isNew);
      onSelectCoverPageId(current.coverPageId);
      showTempNotice('Cover page saved');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBlankOrNew = async (fromScratch: boolean) => {
    const baseTpl = coverPageTemplates[0] || STARTER_COVER_PAGE_TEMPLATES[0];
    const created = createCoverPageFromTemplate(
      userId,
      baseTpl,
      linkedCV,
      fromScratch ? 'Custom Blank Cover Page' : `${baseTpl.templateName} Cover`
    );
    if (fromScratch) {
      created.backgroundConfiguration = {
        type: 'minimal-white',
        primaryColor: '#FFFFFF',
        secondaryColor: '#F8FAFC',
        gradientAngle: 180,
        patternType: 'none',
        marginMm: 16,
        showBleedGuides: true,
      };
      created.designConfiguration.elements = created.designConfiguration.elements.filter((elItem) =>
        ['full_name', 'prof_title', 'intro', 'contact'].includes(elItem.id)
      );
    }
    await onSaveCoverPage(created, true);
    onSelectCoverPageId(created.coverPageId);
    setDraft(created);
    setHistory([created]);
    setHistoryIdx(0);
    setSelectedElementId(null);
    showTempNotice(fromScratch ? 'Created blank canvas' : 'Created new cover page');
  };

  const handleApplyTemplate = (tpl: CoverPageTemplate) => {
    commitChange((prev) => {
      const fresh = JSON.parse(JSON.stringify(tpl.designConfiguration));
      const freshBg = JSON.parse(JSON.stringify(tpl.previewConfiguration.backgroundConfiguration));
      // Preserve user's uploaded photo/logos on matching slots
      fresh.elements = fresh.elements.map((elItem: CoverCanvasElement) => {
        if (elItem.type === 'photo' && prev.uploadedImages.profilePhoto) {
          return { ...elItem, src: prev.uploadedImages.profilePhoto };
        }
        if (elItem.type === 'personalLogo' && prev.uploadedImages.personalLogo) {
          return { ...elItem, src: prev.uploadedImages.personalLogo };
        }
        if (elItem.type === 'companyLogo' && prev.uploadedImages.companyLogo) {
          return { ...elItem, src: prev.uploadedImages.companyLogo };
        }
        return elItem;
      });
      return {
        ...prev,
        templateId: tpl.templateId,
        designConfiguration: fresh,
        backgroundConfiguration: freshBg,
      };
    });
    setSelectedElementId(null);
    showTempNotice(`Applied "${tpl.templateName}"`);
  };

  const handleRestoreTemplate = () => {
    const tpl = coverPageTemplates.find((t) => t.templateId === current.templateId);
    if (tpl) handleApplyTemplate(tpl);
  };

  const updatePersonalInfo = (field: keyof CoverPagePersonalInfo, value: string) => {
    commitChange((prev) => ({
      ...prev,
      personalInformation: { ...prev.personalInformation, [field]: value },
    }));
  };

  const addDesignElement = (
    kind: 'text' | 'colorBlock' | 'rect' | 'circle' | 'line' | 'icon' | 'photo' | 'companyLogo'
  ) => {
    const id = `el_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const maxZ = current.designConfiguration.elements.reduce(
      (m, item) => Math.max(m, item.zIndex),
      1
    );
    const primary = current.designConfiguration.primaryColor;
    const secondary = current.designConfiguration.secondaryColor;

    let newEl: CoverCanvasElement;
    if (kind === 'text') {
      newEl = {
        id,
        type: 'text',
        label: 'Custom Text Box',
        text: 'Double-click or edit text in sidebar',
        x: 12,
        y: 44,
        width: 48,
        height: 8,
        zIndex: maxZ + 1,
        opacity: 1,
        style: {
          fontFamily: current.designConfiguration.fontFamily,
          fontSize: 14,
          fontWeight: '500',
          color: current.designConfiguration.textColor,
          textAlign: 'left',
          lineHeight: 1.45,
        },
      };
    } else if (kind === 'colorBlock') {
      newEl = {
        id,
        type: 'colorBlock',
        label: 'Color Block',
        x: 10,
        y: 10,
        width: 32,
        height: 16,
        zIndex: 2,
        opacity: 0.92,
        style: { backgroundColor: primary },
      };
    } else if (kind === 'circle') {
      newEl = {
        id,
        type: 'shape',
        label: 'Circle Shape',
        shapeKind: 'circle',
        x: 62,
        y: 14,
        width: 22,
        height: 16,
        zIndex: 2,
        opacity: 0.25,
        style: { backgroundColor: secondary, borderColor: primary, borderWidth: 1 },
      };
    } else if (kind === 'rect') {
      newEl = {
        id,
        type: 'shape',
        label: 'Framed Card',
        shapeKind: 'rounded',
        x: 10,
        y: 55,
        width: 80,
        height: 18,
        zIndex: 2,
        opacity: 1,
        style: {
          backgroundColor: current.designConfiguration.accentColor,
          borderColor: secondary,
          borderWidth: 1,
          borderRadius: 8,
        },
      };
    } else if (kind === 'line') {
      newEl = {
        id,
        type: 'line',
        label: 'Accent Rule',
        x: 10,
        y: 48,
        width: 40,
        height: 0.5,
        zIndex: maxZ + 1,
        opacity: 1,
        style: { backgroundColor: secondary },
      };
    } else if (kind === 'icon') {
      newEl = {
        id,
        type: 'icon',
        label: 'Emblem Icon',
        iconName: 'award',
        x: 10,
        y: 10,
        width: 7,
        height: 5.5,
        zIndex: maxZ + 1,
        opacity: 1,
        style: { color: secondary },
      };
    } else {
      newEl = {
        id,
        type: kind,
        label: kind === 'photo' ? 'Profile Photo' : 'Company Logo',
        src:
          kind === 'photo'
            ? current.uploadedImages.profilePhoto
            : current.uploadedImages.companyLogo,
        x: 70,
        y: 10,
        width: 20,
        height: 16,
        zIndex: maxZ + 1,
        opacity: 1,
        crop: { zoom: 1, offsetX: 0, offsetY: 0, shape: kind === 'photo' ? 'circle' : 'rounded' },
        style: { borderColor: primary, borderWidth: kind === 'photo' ? 2 : 0 },
      };
    }

    commitChange((prev) => ({
      ...prev,
      designConfiguration: {
        ...prev.designConfiguration,
        elements: [...prev.designConfiguration.elements, newEl],
      },
    }));
    setSelectedElementId(id);
  };

  const handleGenerateAICover = async (promptToRun?: string) => {
    const cleanPrompt = (promptToRun ?? aiPrompt).trim();
    if (!cleanPrompt) return;
    setAiLoading(true);
    setAiError('');
    try {
      const resp = await fetch('/api/ai/cover-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: cleanPrompt,
          currentDesign: current.designConfiguration,
          currentBackground: current.backgroundConfiguration,
          personalInformation: current.personalInformation,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'AI cover page generation failed.');

      commitChange((prev) => {
        const nextDesign = data.designConfiguration;
        nextDesign.elements = nextDesign.elements.map((elItem: CoverCanvasElement) => {
          if (elItem.type === 'photo' && prev.uploadedImages.profilePhoto) {
            return { ...elItem, src: prev.uploadedImages.profilePhoto };
          }
          if (elItem.type === 'companyLogo' && prev.uploadedImages.companyLogo) {
            return { ...elItem, src: prev.uploadedImages.companyLogo };
          }
          if (elItem.type === 'personalLogo' && prev.uploadedImages.personalLogo) {
            return { ...elItem, src: prev.uploadedImages.personalLogo };
          }
          return elItem;
        });
        return {
          ...prev,
          designConfiguration: nextDesign,
          backgroundConfiguration: {
            ...data.backgroundConfiguration,
            showBleedGuides: prev.backgroundConfiguration.showBleedGuides,
          },
        };
      });
      setAiHistory((prev) => [{ prompt: cleanPrompt, rationale: data.rationale }, ...prev]);
      showTempNotice('Applied AI Cover Design');
    } catch (err: any) {
      setAiError(err?.message || 'Failed generating AI cover page.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveAssetImage = (
    assetKey: 'profilePhoto' | 'personalLogo' | 'companyLogo' | 'backgroundImage',
    finalUrl: string,
    crop: any,
    targetElementId?: string
  ) => {
    commitChange((prev) => {
      const nextUploaded = { ...prev.uploadedImages, [assetKey]: finalUrl };
      if (assetKey === 'backgroundImage') {
        return {
          ...prev,
          uploadedImages: nextUploaded,
          backgroundConfiguration: {
            ...prev.backgroundConfiguration,
            type: 'image',
            imageUrl: finalUrl,
            imageOpacity: prev.backgroundConfiguration.imageOpacity ?? 0.38,
          },
        };
      }

      const targetType =
        assetKey === 'profilePhoto'
          ? 'photo'
          : assetKey === 'personalLogo'
          ? 'personalLogo'
          : 'companyLogo';

      const hasMatchingEl = prev.designConfiguration.elements.some(
        (e) => (targetElementId && e.id === targetElementId) || e.type === targetType
      );

      let nextElements = prev.designConfiguration.elements.map((e) =>
        (targetElementId && e.id === targetElementId) || e.type === targetType
          ? { ...e, src: finalUrl, crop }
          : e
      );

      if (!hasMatchingEl) {
        nextElements = [
          ...nextElements,
          {
            id: `img_${Date.now()}`,
            type: targetType,
            label:
              targetType === 'photo'
                ? 'Profile Photo'
                : targetType === 'personalLogo'
                ? 'Personal Logo'
                : 'Company Logo',
            src: finalUrl,
            x: targetType === 'photo' ? 72 : 10,
            y: 10,
            width: targetType === 'photo' ? 19 : 16,
            height: targetType === 'photo' ? 15 : 8,
            zIndex: 15,
            opacity: 1,
            crop,
            style: {
              borderColor: prev.designConfiguration.primaryColor,
              borderWidth: targetType === 'photo' ? 2 : 0,
            },
          },
        ];
      }

      return {
        ...prev,
        uploadedImages: nextUploaded,
        designConfiguration: { ...prev.designConfiguration, elements: nextElements },
      };
    });
    setCropModal(null);
    showTempNotice('Image uploaded & applied');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] overflow-hidden bg-slate-100">
      {/* Top Studio Bar */}
      <div className="no-print bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <button
            type="button"
            onClick={() => setMobilePanelOpen(!mobilePanelOpen)}
            className="lg:hidden px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-slate-50 text-slate-700 inline-flex items-center gap-1"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{mobilePanelOpen ? 'Canvas' : 'Controls'}</span>
          </button>

          {coverPages.length > 0 && (
            <select
              value={current.coverPageId}
              onChange={(e) => onSelectCoverPageId(e.target.value)}
              aria-label="Select saved cover page"
              className="text-xs font-semibold text-[#142B4A] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 max-w-[190px]"
            >
              {coverPages.map((c) => (
                <option key={c.coverPageId} value={c.coverPageId}>
                  {c.title}
                </option>
              ))}
            </select>
          )}

          <input
            type="text"
            value={current.title}
            onChange={(e) => commitChange((prev) => ({ ...prev, title: e.target.value }))}
            aria-label="Cover page title"
            className="text-sm font-bold text-[#142B4A] bg-transparent border border-transparent hover:border-slate-300 focus:border-[#2864A6] focus:bg-white rounded-md px-2 py-1 min-w-[140px] max-w-[220px] truncate focus:outline-none"
          />

          {cvs.length > 0 && (
            <div className="hidden xl:flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <Link2 className="w-3.5 h-3.5 text-[#2864A6]" />
              <select
                value={current.cvId || ''}
                onChange={async (e) => {
                  const targetCvId = e.target.value;
                  commitChange((prev) => ({ ...prev, cvId: targetCvId }));
                  if (targetCvId && coverPages.some((cp) => cp.coverPageId === current.coverPageId)) {
                    await onAttachToCV(targetCvId, current.coverPageId);
                    showTempNotice('Attached to CV');
                  }
                }}
                aria-label="Attach cover page to CV"
                className="bg-transparent text-slate-700 font-medium focus:outline-none max-w-[170px]"
              >
                <option value="">Not attached to a CV</option>
                {cvs.map((c) => (
                  <option key={c.cvId} value={c.cvId}>
                    CV: {c.cvTitle}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {notice && (
            <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1 mr-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{notice}</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => handleCreateBlankOrNew(false)}
            className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 inline-flex items-center gap-1"
            title="New Cover Page"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">New</span>
          </button>

          <button
            type="button"
            onClick={() => historyIdx > 0 && setHistoryIdx((i) => i - 1)}
            disabled={historyIdx <= 0}
            className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-35 rounded-lg border border-slate-200"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => historyIdx < history.length - 1 && setHistoryIdx((i) => i + 1)}
            disabled={historyIdx >= history.length - 1}
            className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-35 rounded-lg border border-slate-200"
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleRestoreTemplate}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 inline-flex items-center gap-1"
            title="Restore Template Defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Restore</span>
          </button>

          <button
            type="button"
            onClick={handleSaveNow}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-[#2864A6] hover:bg-[#1f528b] rounded-lg inline-flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen(!exportOpen)}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#142B4A] hover:bg-[#1e3d66] rounded-lg inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            {exportOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-4 z-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#142B4A]">Export Cover Page & CV</span>
                  <select
                    value={exportPageSize}
                    onChange={(e) => setExportPageSize(e.target.value as 'A4' | 'LETTER')}
                    className="px-2 py-1 text-[11px] border border-slate-200 rounded-md bg-white font-semibold"
                  >
                    <option value="A4">A4</option>
                    <option value="LETTER">US Letter</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Cover Page Only
                  </div>
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={async () => {
                      setExporting(true);
                      try {
                        await exportCoverPageToVectorPDF(current, exportPageSize);
                      } finally {
                        setExporting(false);
                      }
                    }}
                    className="w-full py-2 px-3 bg-[#142B4A] hover:bg-[#1e3d66] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Download Cover Page PDF</span>
                  </button>
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={async () => {
                      setExporting(true);
                      try {
                        await exportCoverPageToDOCX(current, exportPageSize);
                      } finally {
                        setExporting(false);
                      }
                    }}
                    className="w-full py-2 px-3 bg-[#EAF2FB] hover:bg-[#dce9f9] text-[#142B4A] text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Cover Page Word (.docx)</span>
                  </button>
                </div>

                {linkedCV && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="text-[11px] font-bold text-[#2864A6] uppercase tracking-wider truncate">
                      Combined: Cover + {linkedCV.cvTitle}
                    </div>
                    <button
                      type="button"
                      disabled={exporting}
                      onClick={async () => {
                        setExporting(true);
                        try {
                          await exportCombinedCVWithCoverPDF(
                            current,
                            linkedCV,
                            resolvedLinkedCVDesign,
                            { pageSize: exportPageSize }
                          );
                        } finally {
                          setExporting(false);
                        }
                      }}
                      className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Download Complete CV + Cover PDF</span>
                    </button>
                    <button
                      type="button"
                      disabled={exporting}
                      onClick={async () => {
                        setExporting(true);
                        try {
                          await exportCombinedCVWithCoverDOCX(
                            current,
                            linkedCV,
                            resolvedLinkedCVDesign,
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
                  </div>
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
                  <span>Print Preview</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Two-Panel Studio */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* LEFT PANEL */}
        <aside
          className={`no-print bg-white border-r border-slate-200 flex flex-col w-full lg:w-[440px] xl:w-[470px] shrink-0 ${
            mobilePanelOpen ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Studio Left Navigation Tabs */}
          <div className="grid grid-cols-6 border-b border-slate-200 bg-slate-50/70">
            {(
              [
                { id: 'templates', label: 'Templates' },
                { id: 'text', label: 'Text' },
                { id: 'images', label: 'Images' },
                { id: 'design', label: 'Design' },
                { id: 'layers', label: 'Layers' },
                { id: 'ai', label: 'AI Studio' },
              ] as Array<{ id: LeftTab; label: string }>
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setLeftTab(t.id)}
                className={`py-2.5 px-1 text-[11px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  leftTab === t.id
                    ? 'border-[#142B4A] text-[#142B4A] bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 studio-scroll">
            {/* TAB 1: TEMPLATES (25+ Templates) */}
            {leftTab === 'templates' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={tplSearch}
                      onChange={(e) => setTplSearch(e.target.value)}
                      placeholder="Search 25+ cover templates..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCreateBlankOrNew(true)}
                    className="px-2.5 py-1.5 text-[11px] font-semibold border border-slate-300 text-[#142B4A] rounded-lg hover:bg-slate-50 shrink-0"
                  >
                    Start Blank
                  </button>
                </div>

                <select
                  value={tplCategory}
                  onChange={(e) => setTplCategory(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-[#142B4A]"
                >
                  <option value="All">All Categories ({coverPageTemplates.length})</option>
                  {COVER_PAGE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  {filteredTemplates.map((tpl) => {
                    const isCurrent = current.templateId === tpl.templateId;
                    const thumbDoc: CoverPageDocument = {
                      coverPageId: tpl.templateId,
                      userId,
                      templateId: tpl.templateId,
                      title: tpl.templateName,
                      personalInformation: tpl.previewConfiguration.samplePersonalInfo,
                      designConfiguration: tpl.designConfiguration,
                      backgroundConfiguration: tpl.previewConfiguration.backgroundConfiguration,
                      uploadedImages: {},
                      pageSize: tpl.previewConfiguration.defaultPageSize || 'A4',
                      createdAt: '',
                      updatedAt: '',
                    };
                    return (
                      <button
                        key={tpl.templateId}
                        type="button"
                        onClick={() => handleApplyTemplate(tpl)}
                        className={`text-left rounded-xl border overflow-hidden transition-all flex flex-col ${
                          isCurrent
                            ? 'border-[#142B4A] ring-2 ring-[#2864A6]/30 bg-[#EAF2FB]/40'
                            : 'border-slate-200 hover:border-[#2864A6] bg-white'
                        }`}
                      >
                        <div className="bg-slate-100 h-44 p-2 flex justify-center items-start overflow-hidden border-b border-slate-100">
                          <div className="pointer-events-none">
                            <CoverPageRenderer coverPage={thumbDoc} scale={0.148} />
                          </div>
                        </div>
                        <div className="p-2.5">
                          <div className="text-xs font-bold text-[#142B4A] truncate">
                            {tpl.templateName}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">
                            {tpl.category}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: TEXT & PERSONAL INFORMATION */}
            {leftTab === 'text' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 bg-[#EAF2FB]/70 border border-[#2864A6]/20 rounded-xl p-2.5">
                  <div className="text-[11px] text-[#142B4A]">
                    <span className="font-bold block">Personal & Cover Copy</span>
                    <span className="text-slate-600">Edits update all bound canvas fields live.</span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {linkedCV && (
                      <button
                        type="button"
                        onClick={() => {
                          commitChange((prev) => ({
                            ...prev,
                            personalInformation: createCoverPersonalInfoFromCV(linkedCV),
                          }));
                          showTempNotice('Synced info from CV');
                        }}
                        className="px-2.5 py-1.5 text-[11px] font-semibold bg-white border border-slate-300 text-[#142B4A] rounded-lg"
                      >
                        Sync CV Info
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => addDesignElement('text')}
                      className="px-2.5 py-1.5 text-[11px] font-semibold bg-[#142B4A] text-white rounded-lg inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Text</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-[#142B4A]">Personal Information</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Full Name</label>
                      <input
                        type="text"
                        value={current.personalInformation.fullName}
                        onChange={(e) => updatePersonalInfo('fullName', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Professional Title</label>
                      <input
                        type="text"
                        value={current.personalInformation.professionalTitle}
                        onChange={(e) => updatePersonalInfo('professionalTitle', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Professional Subtitle</label>
                      <input
                        type="text"
                        value={current.personalInformation.professionalSubtitle}
                        onChange={(e) => updatePersonalInfo('professionalSubtitle', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Email</label>
                      <input
                        type="email"
                        value={current.personalInformation.email}
                        onChange={(e) => updatePersonalInfo('email', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Telephone</label>
                      <input
                        type="text"
                        value={current.personalInformation.phone}
                        onChange={(e) => updatePersonalInfo('phone', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Location</label>
                      <input
                        type="text"
                        value={current.personalInformation.location}
                        onChange={(e) => updatePersonalInfo('location', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Website</label>
                      <input
                        type="text"
                        value={current.personalInformation.website}
                        onChange={(e) => updatePersonalInfo('website', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">LinkedIn Profile</label>
                      <input
                        type="text"
                        value={current.personalInformation.linkedin}
                        onChange={(e) => updatePersonalInfo('linkedin', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 pt-3 border-t border-slate-200">
                  <div className="text-xs font-bold text-[#142B4A]">Cover Page Text</div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">CV Title / Dossier Label</label>
                    <input
                      type="text"
                      value={current.personalInformation.cvTitle}
                      onChange={(e) => updatePersonalInfo('cvTitle', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Professional Tagline</label>
                    <input
                      type="text"
                      value={current.personalInformation.tagline}
                      onChange={(e) => updatePersonalInfo('tagline', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Career Specialty</label>
                    <input
                      type="text"
                      value={current.personalInformation.careerSpecialty}
                      onChange={(e) => updatePersonalInfo('careerSpecialty', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Short Professional Introduction</label>
                    <textarea
                      rows={3}
                      value={current.personalInformation.introduction}
                      onChange={(e) => updatePersonalInfo('introduction', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Document Date</label>
                      <input
                        type="text"
                        value={current.personalInformation.documentDate}
                        onChange={(e) => updatePersonalInfo('documentDate', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Target Organization</label>
                      <input
                        type="text"
                        value={current.personalInformation.targetOrganization}
                        onChange={(e) => updatePersonalInfo('targetOrganization', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: IMAGE UPLOADS & CROP / BACKGROUND REMOVAL */}
            {leftTab === 'images' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Upload JPG, JPEG, PNG, or WebP assets. Crop, zoom, rotate, choose circular/rounded/square framing, or strip uniform backdrops.
                </p>

                {[
                  { key: 'profilePhoto' as const, label: 'Profile Photograph', desc: 'Executive portrait or headshot' },
                  { key: 'personalLogo' as const, label: 'Personal Logo', desc: 'Monogram or personal brand mark' },
                  { key: 'companyLogo' as const, label: 'Company / Target Logo', desc: 'Organization crest or emblem' },
                  { key: 'backgroundImage' as const, label: 'Background Image', desc: 'Full-bleed textured or editorial backdrop' },
                ].map((slot) => {
                  const existingSrc = current.uploadedImages[slot.key];
                  return (
                    <div
                      key={slot.key}
                      className="p-3 border border-slate-200 rounded-xl bg-slate-50/60 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-lg border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                          {existingSrc ? (
                            <img src={existingSrc} alt={slot.label} className="w-full h-full object-cover" />
                          ) : (
                            <ImagePlus className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#142B4A] truncate">{slot.label}</div>
                          <div className="text-[11px] text-slate-500 truncate">{slot.desc}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setCropModal({ assetKey: slot.key, title: slot.label })}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-[#142B4A] text-white rounded-lg"
                        >
                          {existingSrc ? 'Edit' : 'Upload'}
                        </button>
                        {existingSrc && (
                          <button
                            type="button"
                            onClick={() =>
                              commitChange((prev) => {
                                const nextImgs = { ...prev.uploadedImages };
                                delete nextImgs[slot.key];
                                return {
                                  ...prev,
                                  uploadedImages: nextImgs,
                                  backgroundConfiguration:
                                    slot.key === 'backgroundImage'
                                      ? { ...prev.backgroundConfiguration, type: 'solid', imageUrl: undefined }
                                      : prev.backgroundConfiguration,
                                };
                              })
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                            title="Remove image"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 4: DESIGN, BACKGROUNDS, COLORS, TYPOGRAPHY & ELEMENTS */}
            {leftTab === 'design' && (
              <div className="space-y-5">
                {/* 8 Color Schemes */}
                <div>
                  <label className="block text-xs font-bold text-[#142B4A] mb-2">Color Schemes</label>
                  <div className="grid grid-cols-2 gap-2">
                    {COVER_COLOR_SCHEMES.map((scheme) => {
                      const active = current.designConfiguration.colorSchemeName === scheme.name;
                      return (
                        <button
                          key={scheme.name}
                          type="button"
                          onClick={() =>
                            commitChange((prev) => ({
                              ...prev,
                              designConfiguration: {
                                ...prev.designConfiguration,
                                colorSchemeName: scheme.name,
                                primaryColor: scheme.primary,
                                secondaryColor: scheme.secondary,
                                accentColor: scheme.accent,
                                textColor: scheme.text,
                                mutedTextColor: scheme.muted,
                              },
                            }))
                          }
                          className={`p-2 rounded-lg border text-left flex items-center gap-2 ${
                            active ? 'border-[#142B4A] bg-[#EAF2FB]/60' : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex -space-x-1 shrink-0">
                            <span
                              className="w-4 h-4 rounded-full border border-white shadow-2xs"
                              style={{ backgroundColor: scheme.primary }}
                            />
                            <span
                              className="w-4 h-4 rounded-full border border-white shadow-2xs"
                              style={{ backgroundColor: scheme.secondary }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-800 truncate">
                            {scheme.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Background Options */}
                <div className="pt-3 border-t border-slate-200 space-y-2.5">
                  <label className="block text-xs font-bold text-[#142B4A]">Background Style</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={current.backgroundConfiguration.type}
                      onChange={(e) =>
                        commitChange((prev) => ({
                          ...prev,
                          backgroundConfiguration: {
                            ...prev.backgroundConfiguration,
                            type: e.target.value as CoverBackgroundType,
                          },
                        }))
                      }
                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="solid">Solid Color</option>
                      <option value="gradient">Gradient</option>
                      <option value="pattern-geometric">Geometric Pattern</option>
                      <option value="pattern-abstract">Abstract Pattern</option>
                      <option value="image">Uploaded Image</option>
                      <option value="minimal-white">Minimalist White</option>
                    </select>
                    <select
                      value={current.backgroundConfiguration.patternType || 'none'}
                      onChange={(e) =>
                        commitChange((prev) => ({
                          ...prev,
                          backgroundConfiguration: {
                            ...prev.backgroundConfiguration,
                            patternType: e.target.value as CoverPatternType,
                          },
                        }))
                      }
                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="none">No Pattern</option>
                      <option value="dots">Dots Matrix</option>
                      <option value="grid">Architectural Grid</option>
                      <option value="diagonal">Diagonal Lines</option>
                      <option value="rings">Orbital Rings</option>
                      <option value="waves">Abstract Waves</option>
                      <option value="hexagons">Hexagon Mesh</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'primaryColor', label: 'Bg Primary' },
                      { key: 'secondaryColor', label: 'Bg Secondary' },
                      { key: 'patternColor', label: 'Pattern Tint' },
                    ].map((c) => (
                      <label key={c.key} className="block text-[11px] font-semibold text-slate-600">
                        <span className="block mb-1">{c.label}</span>
                        <input
                          type="color"
                          value={(current.backgroundConfiguration as any)[c.key] || '#142B4A'}
                          onChange={(e) =>
                            commitChange((prev) => ({
                              ...prev,
                              backgroundConfiguration: {
                                ...prev.backgroundConfiguration,
                                [c.key]: e.target.value,
                              },
                            }))
                          }
                          className="w-full h-8 border border-slate-200 rounded-lg p-0.5 bg-white cursor-pointer"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Typography */}
                <div className="pt-3 border-t border-slate-200 space-y-2.5">
                  <div className="text-xs font-bold text-[#142B4A]">Typography</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Body Font</label>
                      <select
                        value={current.designConfiguration.fontFamily}
                        onChange={(e) =>
                          commitChange((prev) => ({
                            ...prev,
                            designConfiguration: {
                              ...prev.designConfiguration,
                              fontFamily: e.target.value as CoverPageFontFamily,
                            },
                          }))
                        }
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        {COVER_PAGE_FONT_OPTIONS.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Heading Font</label>
                      <select
                        value={current.designConfiguration.headingFontFamily}
                        onChange={(e) =>
                          commitChange((prev) => ({
                            ...prev,
                            designConfiguration: {
                              ...prev.designConfiguration,
                              headingFontFamily: e.target.value as CoverPageFontFamily,
                            },
                          }))
                        }
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        {COVER_PAGE_FONT_OPTIONS.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Insert Decorative & Layout Elements */}
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-[#142B4A]">Insert Design Elements</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'text', label: '+ Text Box' },
                      { id: 'colorBlock', label: '+ Color Block' },
                      { id: 'rect', label: '+ Framed Card' },
                      { id: 'circle', label: '+ Circle Shape' },
                      { id: 'line', label: '+ Divider Line' },
                      { id: 'icon', label: '+ Emblem Icon' },
                      { id: 'photo', label: '+ Photo Slot' },
                      { id: 'companyLogo', label: '+ Logo Slot' },
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => addDesignElement(btn.id as any)}
                        className="py-1.5 px-2.5 text-xs font-semibold text-[#142B4A] bg-slate-50 hover:bg-[#EAF2FB] border border-slate-200 rounded-lg text-left"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: PAGE SIZE, MARGINS, ELEMENT INSPECTOR & LAYER STACK */}
            {leftTab === 'layers' && (
              <div className="space-y-4">
                <div className="p-3 border border-slate-200 rounded-xl bg-slate-50/70 space-y-2.5">
                  <div className="text-xs font-bold text-[#142B4A]">Page Dimensions & Guides</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['A4', 'LETTER', 'CUSTOM'] as CoverPageSize[]).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => commitChange((prev) => ({ ...prev, pageSize: sz }))}
                        className={`py-1.5 text-xs font-semibold rounded-lg border ${
                          current.pageSize === sz
                            ? 'bg-[#142B4A] text-white border-[#142B4A]'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>

                  {current.pageSize === 'CUSTOM' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600">Width (mm)</label>
                        <input
                          type="number"
                          min={120}
                          max={350}
                          value={current.designConfiguration.customWidthMm || 210}
                          onChange={(e) =>
                            commitChange((prev) => ({
                              ...prev,
                              designConfiguration: {
                                ...prev.designConfiguration,
                                customWidthMm: Number(e.target.value),
                              },
                            }))
                          }
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600">Height (mm)</label>
                        <input
                          type="number"
                          min={150}
                          max={450}
                          value={current.designConfiguration.customHeightMm || 297}
                          onChange={(e) =>
                            commitChange((prev) => ({
                              ...prev,
                              designConfiguration: {
                                ...prev.designConfiguration,
                                customHeightMm: Number(e.target.value),
                              },
                            }))
                          }
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={current.backgroundConfiguration.showBleedGuides}
                        onChange={(e) =>
                          commitChange((prev) => ({
                            ...prev,
                            backgroundConfiguration: {
                              ...prev.backgroundConfiguration,
                              showBleedGuides: e.target.checked,
                            },
                          }))
                        }
                      />
                      <span>Show Margin & Bleed Guides</span>
                    </label>
                    <span className="text-[11px] text-slate-500 tabular-nums">
                      {current.backgroundConfiguration.marginMm}mm
                    </span>
                  </div>
                </div>

                {/* Selected Canvas Object Inspector */}
                {selectedElement ? (
                  <div className="p-3.5 border border-[#2864A6]/35 bg-[#EAF2FB]/40 rounded-xl space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-[#142B4A] truncate">
                        Selected: {selectedElement.label}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            commitElementPatch(selectedElement.id, {
                              zIndex: selectedElement.zIndex + 1,
                            })
                          }
                          title="Bring Forward"
                          className="p-1 bg-white border border-slate-200 rounded text-slate-700"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            commitElementPatch(selectedElement.id, {
                              zIndex: Math.max(1, selectedElement.zIndex - 1),
                            })
                          }
                          title="Send Backward"
                          className="p-1 bg-white border border-slate-200 rounded text-slate-700"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const dup: CoverCanvasElement = {
                              ...JSON.parse(JSON.stringify(selectedElement)),
                              id: `dup_${Date.now()}`,
                              label: `${selectedElement.label} Copy`,
                              x: Math.min(85, selectedElement.x + 3),
                              y: Math.min(90, selectedElement.y + 3),
                              zIndex: selectedElement.zIndex + 1,
                              locked: false,
                            };
                            commitChange((prev) => ({
                              ...prev,
                              designConfiguration: {
                                ...prev.designConfiguration,
                                elements: [...prev.designConfiguration.elements, dup],
                              },
                            }));
                            setSelectedElementId(dup.id);
                          }}
                          title="Duplicate Element"
                          className="p-1 bg-white border border-slate-200 rounded text-slate-700"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            commitElementPatch(selectedElement.id, {
                              locked: !selectedElement.locked,
                            })
                          }
                          title={selectedElement.locked ? 'Unlock' : 'Lock'}
                          className="p-1 bg-white border border-slate-200 rounded text-slate-700"
                        >
                          {selectedElement.locked ? (
                            <Lock className="w-3 h-3 text-amber-600" />
                          ) : (
                            <Unlock className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            commitChange((prev) => ({
                              ...prev,
                              designConfiguration: {
                                ...prev.designConfiguration,
                                elements: prev.designConfiguration.elements.filter(
                                  (e) => e.id !== selectedElement.id
                                ),
                              },
                            }));
                            setSelectedElementId(null);
                          }}
                          title="Delete Element"
                          className="p-1 bg-white border border-rose-200 rounded text-rose-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {selectedElement.type === 'text' && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {!selectedElement.fieldBinding && (
                          <div className="col-span-2">
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Text Content</label>
                            <textarea
                              rows={2}
                              value={selectedElement.text || ''}
                              onChange={(e) =>
                                commitElementPatch(selectedElement.id, { text: e.target.value })
                              }
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                            />
                          </div>
                        )}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Font</label>
                          <select
                            value={
                              selectedElement.style.fontFamily ||
                              current.designConfiguration.fontFamily
                            }
                            onChange={(e) =>
                              commitElementPatch(selectedElement.id, {
                                style: {
                                  ...selectedElement.style,
                                  fontFamily: e.target.value as CoverPageFontFamily,
                                },
                              })
                            }
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                          >
                            {COVER_PAGE_FONT_OPTIONS.map((f) => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                            Size ({selectedElement.style.fontSize || 14}px)
                          </label>
                          <input
                            type="range"
                            min={8}
                            max={54}
                            value={selectedElement.style.fontSize || 14}
                            onChange={(e) =>
                              commitElementPatch(selectedElement.id, {
                                style: { ...selectedElement.style, fontSize: Number(e.target.value) },
                              })
                            }
                            className="w-full accent-[#142B4A]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Align</label>
                          <div className="grid grid-cols-3 gap-1">
                            {(['left', 'center', 'right'] as const).map((al) => (
                              <button
                                key={al}
                                type="button"
                                onClick={() =>
                                  commitElementPatch(selectedElement.id, {
                                    style: { ...selectedElement.style, textAlign: al },
                                  })
                                }
                                className={`py-1 text-[10px] font-semibold rounded border capitalize ${
                                  (selectedElement.style.textAlign || 'left') === al
                                    ? 'bg-[#142B4A] text-white border-[#142B4A]'
                                    : 'bg-white text-slate-700 border-slate-200'
                                }`}
                              >
                                {al}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Text Color</label>
                          <input
                            type="color"
                            value={selectedElement.style.color || '#1E293B'}
                            onChange={(e) =>
                              commitElementPatch(selectedElement.id, {
                                style: { ...selectedElement.style, color: e.target.value },
                              })
                            }
                            className="w-full h-7 border border-slate-300 rounded bg-white p-0.5"
                          />
                        </div>
                      </div>
                    )}

                    {(selectedElement.type === 'colorBlock' ||
                      selectedElement.type === 'shape' ||
                      selectedElement.type === 'line') && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Fill Color</label>
                          <input
                            type="color"
                            value={
                              selectedElement.style.backgroundColor &&
                              selectedElement.style.backgroundColor !== 'transparent'
                                ? selectedElement.style.backgroundColor
                                : '#142B4A'
                            }
                            onChange={(e) =>
                              commitElementPatch(selectedElement.id, {
                                style: { ...selectedElement.style, backgroundColor: e.target.value },
                              })
                            }
                            className="w-full h-7 border border-slate-300 rounded bg-white p-0.5"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                            Opacity ({Math.round((selectedElement.opacity ?? 1) * 100)}%)
                          </label>
                          <input
                            type="range"
                            min={0.1}
                            max={1}
                            step={0.05}
                            value={selectedElement.opacity ?? 1}
                            onChange={(e) =>
                              commitElementPatch(selectedElement.id, { opacity: Number(e.target.value) })
                            }
                            className="w-full accent-[#142B4A]"
                          />
                        </div>
                      </div>
                    )}

                    {(selectedElement.type === 'photo' ||
                      selectedElement.type === 'personalLogo' ||
                      selectedElement.type === 'companyLogo') && (
                      <button
                        type="button"
                        onClick={() =>
                          setCropModal({
                            assetKey:
                              selectedElement.type === 'photo'
                                ? 'profilePhoto'
                                : selectedElement.type === 'personalLogo'
                                ? 'personalLogo'
                                : 'companyLogo',
                            title: selectedElement.label,
                            elementId: selectedElement.id,
                          })
                        }
                        className="w-full py-1.5 text-xs font-semibold bg-[#142B4A] text-white rounded-lg"
                      >
                        Upload / Crop / Remove Background
                      </button>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/70">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600">
                          Rotation ({selectedElement.rotation || 0}°)
                        </label>
                        <input
                          type="range"
                          min={-45}
                          max={45}
                          value={selectedElement.rotation || 0}
                          onChange={(e) =>
                            commitElementPatch(selectedElement.id, {
                              rotation: Number(e.target.value),
                            })
                          }
                          className="w-full accent-[#142B4A]"
                        />
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-end justify-end tabular-nums">
                        X:{Math.round(selectedElement.x)}% Y:{Math.round(selectedElement.y)}% · W:{Math.round(selectedElement.width)}%
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    Click any element on the canvas or in the layer stack below to move, resize, restyle, lock, or reorder it.
                  </p>
                )}

                {/* Layer Stack */}
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-[#142B4A]">Canvas Layers</div>
                  {[...current.designConfiguration.elements]
                    .sort((a, b) => b.zIndex - a.zIndex)
                    .map((elItem) => (
                      <button
                        key={elItem.id}
                        type="button"
                        onClick={() => setSelectedElementId(elItem.id)}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-left flex items-center justify-between text-xs ${
                          selectedElementId === elItem.id
                            ? 'border-[#2864A6] bg-[#EAF2FB] text-[#142B4A] font-semibold'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">{elItem.label}</span>
                        <span className="text-[10px] text-slate-400 tabular-nums ml-2">
                          z{elItem.zIndex} {elItem.locked ? '· Locked' : ''}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* TAB 6: AI COVER PAGE GENERATOR & REFINEMENT */}
            {leftTab === 'ai' && (
              <div className="space-y-4">
                <div className="p-3 bg-[#EAF2FB]/70 border border-[#2864A6]/20 rounded-xl space-y-1">
                  <div className="text-xs font-bold text-[#142B4A] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#2864A6]" />
                    <span>AI Cover Page Design Engine</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Generate an original, fully editable layout from a prompt or iteratively refine your current cover page.
                  </p>
                </div>

                {!aiEnabled ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    AI features are currently paused by platform settings.
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                        Describe Cover Page Design or Refinement
                      </label>
                      <textarea
                        rows={3}
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="e.g., Design an executive navy blue cover page with white typography, subtle geometric background, and space for a portrait photo."
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                      />
                      <button
                        type="button"
                        disabled={aiLoading || !aiPrompt.trim()}
                        onClick={() => handleGenerateAICover()}
                        className="mt-2 w-full py-2.5 bg-[#142B4A] hover:bg-[#1e3d66] disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2"
                      >
                        {aiLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        <span>{aiLoading ? 'Designing Cover Page...' : 'Generate / Refine Design'}</span>
                      </button>
                    </div>

                    {aiError && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                        {aiError}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Quick Refinements
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {AI_REFINEMENT_CHIPS.map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            disabled={aiLoading}
                            onClick={() => {
                              setAiPrompt(chip);
                              handleGenerateAICover(chip);
                            }}
                            className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-[#EAF2FB] text-[#142B4A] rounded-lg border border-slate-200"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Example Prompts
                      </div>
                      <div className="space-y-1.5">
                        {AI_STARTER_PROMPTS.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setAiPrompt(p)}
                            className="w-full text-left p-2 text-[11px] text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg leading-snug"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    {aiHistory.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        <div className="text-[11px] font-bold text-[#142B4A]">Session AI History</div>
                        {aiHistory.map((h, i) => (
                          <div key={i} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] space-y-1">
                            <div className="font-semibold text-[#142B4A]">{h.prompt}</div>
                            <div className="text-slate-600">{h.rationale}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT PANEL: LIVE INTERACTIVE DRAG-AND-DROP CANVAS */}
        <section
          className={`flex-1 flex flex-col min-w-0 bg-slate-100 ${
            mobilePanelOpen ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="no-print bg-white/90 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-semibold text-[#142B4A]">
                {current.pageSize} · {current.designConfiguration.headingFontFamily}
              </span>
              <span className="hidden sm:inline text-slate-400">|</span>
              <span className="hidden sm:inline text-slate-500">
                Drag elements to reposition · Drag corner handle to resize
              </span>
            </div>

            <div className="flex items-center gap-3">
              {linkedCV && (
                <button
                  type="button"
                  onClick={() => setPreviewWithCV(!previewWithCV)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border inline-flex items-center gap-1.5 ${
                    previewWithCV
                      ? 'bg-[#142B4A] text-white border-[#142B4A]'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{previewWithCV ? 'Cover + CV Preview' : 'Preview with CV'}</span>
                </button>
              )}

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.35, Number((z - 0.08).toFixed(2))))}
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
                  onClick={() => setZoom((z) => Math.min(1.15, Number((z + 0.08).toFixed(2))))}
                  className="p-1.5 text-slate-600 hover:bg-slate-200/70 rounded"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6 sm:p-8 flex flex-col items-center gap-8 studio-scroll cv-print-root">
            <CoverPageRenderer
              coverPage={current}
              scale={zoom}
              interactive={!previewWithCV}
              selectedElementId={selectedElementId}
              onSelectElement={setSelectedElementId}
              onUpdateElement={liveUpdateElement}
              onCommitElementHistory={commitElementPatch}
              onDoubleClickElement={(elItem) => {
                if (
                  elItem.type === 'photo' ||
                  elItem.type === 'personalLogo' ||
                  elItem.type === 'companyLogo'
                ) {
                  setCropModal({
                    assetKey:
                      elItem.type === 'photo'
                        ? 'profilePhoto'
                        : elItem.type === 'personalLogo'
                        ? 'personalLogo'
                        : 'companyLogo',
                    title: elItem.label,
                    elementId: elItem.id,
                  });
                } else {
                  setLeftTab('text');
                }
              }}
              printClassName="cv-print-page"
            />

            {previewWithCV && linkedCV && (
              <div className="flex flex-col items-center gap-2">
                <div className="no-print text-xs font-bold text-[#142B4A] uppercase tracking-wider">
                  Page 2+ · Linked CV ({linkedCV.cvTitle})
                </div>
                <CVRenderer
                  cv={linkedCV}
                  design={resolvedLinkedCVDesign}
                  scale={zoom}
                />
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Image Cropper & Background Removal Modal */}
      {cropModal && (
        <ImageCropperModal
          title={cropModal.title}
          userId={userId}
          assetKey={cropModal.assetKey}
          initialSrc={current.uploadedImages[cropModal.assetKey] || ''}
          allowShape={cropModal.assetKey !== 'backgroundImage'}
          onClose={() => setCropModal(null)}
          onSave={(url, crop) =>
            handleSaveAssetImage(cropModal.assetKey, url, crop, cropModal.elementId)
          }
        />
      )}
    </div>
  );
};
