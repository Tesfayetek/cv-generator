import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  Search,
  Sliders,
  X,
} from 'lucide-react';
import { DEFAULT_SECTION_TITLES, SAMPLE_CV_PROFILES } from '../../data/presets';
import type { CVDocument, CVTemplate, DesignConfiguration, TemplateCategory } from '../../types/cv';
import { CVRenderer } from '../cv/CVRenderer';

interface TemplateGalleryViewProps {
  templates: CVTemplate[];
  favoriteIds: string[];
  activeCV: CVDocument | null;
  onToggleFavorite: (templateId: string) => void;
  onUseDesign: (template: CVTemplate) => void;
  onCustomizeDesign: (template: CVTemplate) => void;
}

const CATEGORIES: Array<'All' | TemplateCategory> = [
  'All',
  'Classic Professional',
  'Modern Elegant',
  'Executive and Leadership',
  'NGO and International Development',
  'Academic and Research',
  'Creative and Digital',
  'Entry-Level',
];

function templateToDesign(t: CVTemplate): DesignConfiguration {
  return {
    layout: t.layoutConfiguration,
    colors: t.colorConfiguration,
    typography: t.typographyConfiguration,
    page: t.previewConfiguration.page,
  };
}

function buildPreviewCV(template: CVTemplate, activeCV: CVDocument | null): CVDocument {
  if (activeCV && (activeCV.personalInformation.fullName || activeCV.workExperience.length > 0)) {
    return activeCV;
  }
  const sampleKey = template.previewConfiguration.sampleProfileKey || 'executive';
  const sample = SAMPLE_CV_PROFILES[sampleKey];
  return {
    ...sample,
    cvId: `preview_${template.templateId}`,
    userId: 'preview',
    selectedTemplateId: template.templateId,
    sectionOrder: template.previewConfiguration.defaultSectionOrder || sample.sectionOrder,
    sectionTitles: { ...DEFAULT_SECTION_TITLES, ...sample.sectionTitles },
    createdAt: '',
    updatedAt: '',
  };
}

export const TemplateGalleryView: React.FC<TemplateGalleryViewProps> = ({
  templates,
  favoriteIds,
  activeCV,
  onToggleFavorite,
  onUseDesign,
  onCustomizeDesign,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | TemplateCategory>('All');
  const [selectedProfession, setSelectedProfession] = useState<string>('All');
  const [atsFilter, setAtsFilter] = useState<'all' | 'ats-only'>('all');
  const [columnFilter, setColumnFilter] = useState<'all' | 'one-column' | 'two-column'>('all');
  const [colorFilter, setColorFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'recommended' | 'popular' | 'alphabetical' | 'newest'>('recommended');

  const [previewTemplate, setPreviewTemplate] = useState<CVTemplate | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewTotalPages, setPreviewTotalPages] = useState(1);
  const [useActiveCVInPreview, setUseActiveCVInPreview] = useState(false);

  const professions = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => {
      if (t.profession) set.add(t.profession);
    });
    return ['All', ...Array.from(set).sort()];
  }, [templates]);

  const colorSchemes = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => {
      if (t.colorConfiguration.presetName) set.add(t.colorConfiguration.presetName);
    });
    return ['All', ...Array.from(set).sort()];
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = templates.filter((t) => {
      if (selectedCategory !== 'All' && t.category !== selectedCategory) return false;
      if (selectedProfession !== 'All' && t.profession !== selectedProfession) return false;
      if (atsFilter === 'ats-only' && !t.atsFriendly) return false;
      const isOneCol = t.layoutConfiguration.structure === 'one-column';
      if (columnFilter === 'one-column' && !isOneCol) return false;
      if (columnFilter === 'two-column' && isOneCol) return false;
      if (colorFilter !== 'All' && t.colorConfiguration.presetName !== colorFilter) return false;
      if (q) {
        const hay = `${t.name} ${t.category} ${t.profession} ${t.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...list];
    if (sortBy === 'popular') {
      sorted.sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0));
    } else if (sortBy === 'alphabetical') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'newest') {
      sorted.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    } else {
      sorted.sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0));
    }
    return sorted;
  }, [templates, searchQuery, selectedCategory, selectedProfession, atsFilter, columnFilter, colorFilter, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#142B4A] tracking-tight">
            CV Design Template Marketplace
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Explore {templates.length} distinct, professionally engineered CV layouts. Switch designs anytime without losing your CV content.
          </p>
        </div>
        <div className="text-xs font-medium text-slate-500 tabular-nums">
          Showing {filteredTemplates.length} of {templates.length} templates · All free
        </div>
      </div>

      {/* Category Tabs */}
      <div className="mt-5 flex items-center gap-1.5 overflow-x-auto pb-2 studio-scroll">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              selectedCategory === cat
                ? 'bg-[#142B4A] text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search & Multi-Filter Bar */}
      <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="lg:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates by name or role..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2864A6]/25 focus:border-[#2864A6]"
          />
        </div>

        <select
          value={selectedProfession}
          onChange={(e) => setSelectedProfession(e.target.value)}
          aria-label="Filter by profession"
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:border-[#2864A6]"
        >
          {professions.map((p) => (
            <option key={p} value={p}>
              {p === 'All' ? 'All Professions' : p}
            </option>
          ))}
        </select>

        <select
          value={columnFilter}
          onChange={(e) => setColumnFilter(e.target.value as any)}
          aria-label="Filter by column layout"
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:border-[#2864A6]"
        >
          <option value="all">All Layouts (1 & 2 Col)</option>
          <option value="one-column">One-Column Designs</option>
          <option value="two-column">Two-Column Designs</option>
        </select>

        <select
          value={colorFilter}
          onChange={(e) => setColorFilter(e.target.value)}
          aria-label="Filter by color scheme"
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:border-[#2864A6]"
        >
          {colorSchemes.map((c) => (
            <option key={c} value={c}>
              {c === 'All' ? 'All Color Schemes' : c}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            aria-label="Sort templates"
            className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:border-[#2864A6]"
          >
            <option value="recommended">Recommended</option>
            <option value="popular">Most Popular</option>
            <option value="alphabetical">Alphabetical (A-Z)</option>
            <option value="newest">Newest</option>
          </select>
          <button
            type="button"
            onClick={() => setAtsFilter(atsFilter === 'all' ? 'ats-only' : 'all')}
            className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              atsFilter === 'ats-only'
                ? 'bg-[#EAF2FB] border-[#2864A6] text-[#142B4A]'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            ATS Ready
          </button>
        </div>
      </div>

      {/* Template Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="mt-10 bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <p className="text-base font-semibold text-[#142B4A]">No templates match these filters</p>
          <p className="text-sm text-slate-500 mt-1">
            Reset your filters or search term to browse all {templates.length} templates.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setSelectedProfession('All');
              setAtsFilter('all');
              setColumnFilter('all');
              setColorFilter('All');
            }}
            className="mt-4 px-4 py-2 text-xs font-semibold bg-[#142B4A] text-white rounded-lg"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => {
            const isFav = favoriteIds.includes(template.templateId);
            const design = templateToDesign(template);
            const previewCV = buildPreviewCV(template, null);

            return (
              <div
                key={template.templateId}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col hover:border-[#2864A6]/50 transition-colors shadow-xs"
              >
                {/* Live Rendered Scaled CV Preview */}
                <div
                  onClick={() => {
                    setPreviewTemplate(template);
                    setPreviewPage(1);
                    setUseActiveCVInPreview(Boolean(activeCV));
                  }}
                  className="bg-slate-100/90 p-4 flex justify-center items-start h-[310px] overflow-hidden cursor-pointer relative group border-b border-slate-200"
                >
                  <div className="pointer-events-none select-none transition-transform duration-200 group-hover:scale-[1.02]">
                    <CVRenderer
                      cv={previewCV}
                      design={design}
                      scale={0.33}
                      singlePagePreview
                    />
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(template.templateId);
                    }}
                    aria-label={isFav ? 'Remove from favorites' : 'Save to favorites'}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/95 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-rose-600 transition-colors shadow-xs"
                  >
                    <Heart
                      className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`}
                    />
                  </button>
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-[#142B4A] leading-snug">
                        {template.name}
                      </h3>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
                      <span>{template.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {template.layoutConfiguration.structure === 'one-column' ? 'One-column' : 'Two-column'}
                      </span>
                      {template.atsFriendly && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-emerald-700">ATS-friendly</span>
                        </>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {template.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewTemplate(template);
                        setPreviewPage(1);
                        setUseActiveCVInPreview(Boolean(activeCV));
                      }}
                      className="py-2 px-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1 whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onCustomizeDesign(template)}
                      className="py-2 px-2 text-xs font-semibold text-[#142B4A] bg-[#EAF2FB] hover:bg-[#dce9f9] rounded-lg transition-colors flex items-center justify-center gap-1 whitespace-nowrap"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Customize</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUseDesign(template)}
                      className="py-2 px-2 text-xs font-semibold text-white bg-[#142B4A] hover:bg-[#1e3d66] rounded-lg transition-colors flex items-center justify-center gap-1 whitespace-nowrap"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Use Design</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Multi-Page Realistic Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#142B4A]">{previewTemplate.name}</h2>
                <p className="text-xs text-slate-500">
                  {previewTemplate.category} · {previewTemplate.profession} ·{' '}
                  {previewTemplate.atsFriendly ? 'ATS-friendly structure' : 'Visual multi-column layout'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeCV && (
                  <button
                    type="button"
                    onClick={() => setUseActiveCVInPreview(!useActiveCVInPreview)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      useActiveCVInPreview
                        ? 'bg-[#EAF2FB] border-[#2864A6] text-[#142B4A]'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    {useActiveCVInPreview ? 'Previewing Your CV Data' : 'Preview Sample Profile'}
                  </button>
                )}

                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                  <button
                    type="button"
                    disabled={previewPage <= 1}
                    onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded hover:bg-white disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 text-xs font-semibold tabular-nums text-slate-700">
                    Page {previewPage} of {previewTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={previewPage >= previewTotalPages}
                    onClick={() => setPreviewPage((p) => Math.min(previewTotalPages, p + 1))}
                    className="p-1 rounded hover:bg-white disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onCustomizeDesign(previewTemplate);
                    setPreviewTemplate(null);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold bg-[#EAF2FB] text-[#142B4A] hover:bg-[#dce9f9] rounded-lg"
                >
                  Customize
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUseDesign(previewTemplate);
                    setPreviewTemplate(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-[#142B4A] text-white hover:bg-[#1e3d66] rounded-lg"
                >
                  Use This Design
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTemplate(null)}
                  className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100 p-6 flex justify-center studio-scroll">
              <CVRenderer
                cv={buildPreviewCV(previewTemplate, useActiveCVInPreview ? activeCV : null)}
                design={templateToDesign(previewTemplate)}
                scale={0.82}
                activePage={previewPage}
                onPageCountChange={(cnt) => {
                  setPreviewTotalPages(cnt);
                  if (previewPage > cnt) setPreviewPage(1);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
