import React, { useState } from 'react';
import {
  BookOpen,
  Copy,
  Download,
  Edit3,
  FilePlus2,
  FileText,
  FileUp,
  History,
  LayoutGrid,
  Palette,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { DEFAULT_DESIGN_CONFIG } from '../../data/presets';
import {
  exportCombinedCVWithCoverDOCX,
  exportCombinedCVWithCoverPDF,
  exportCoverPageToDOCX,
  exportCoverPageToVectorPDF,
  exportToDOCX,
  exportToVectorPDF,
} from '../../utils/exportCV';
import type {
  CVDocument,
  CVTemplate,
  CustomDesign,
  DesignConfiguration,
  UserProfile,
} from '../../types/cv';
import type { CoverPageDocument } from '../../types/coverPage';
import { CoverPageRenderer } from '../cover-page/CoverPageRenderer';
import { CVRenderer } from '../cv/CVRenderer';

interface DashboardViewProps {
  userProfile: UserProfile | null;
  cvs: CVDocument[];
  templates: CVTemplate[];
  customDesigns: CustomDesign[];
  coverPages: CoverPageDocument[];
  onOpenCreateFlow: (method: 'scratch' | 'upload' | 'ai') => void;
  onBrowseTemplates: () => void;
  onOpenAIDesigner: () => void;
  onOpenCustomBuilder: () => void;
  onOpenCoverDesigner: (forCV?: CVDocument) => void;
  onEditCV: (cv: CVDocument) => void;
  onDuplicateCV: (cv: CVDocument) => Promise<void>;
  onDeleteCV: (cvId: string) => Promise<void>;
  onEditCoverPage: (cp: CoverPageDocument) => void;
  onDuplicateCoverPage: (cp: CoverPageDocument) => Promise<void>;
  onDeleteCoverPage: (id: string) => Promise<void>;
  onApplyCustomDesign: (design: CustomDesign) => void;
  onDeleteCustomDesign: (designId: string) => Promise<void>;
  onOpenProfileSettings: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  userProfile,
  cvs,
  templates,
  customDesigns,
  coverPages,
  onOpenCreateFlow,
  onBrowseTemplates,
  onOpenAIDesigner,
  onOpenCustomBuilder,
  onOpenCoverDesigner,
  onEditCV,
  onDuplicateCV,
  onDeleteCV,
  onEditCoverPage,
  onDuplicateCoverPage,
  onDeleteCoverPage,
  onApplyCustomDesign,
  onDeleteCustomDesign,
  onOpenProfileSettings,
}) => {
  const [downloadMenuId, setDownloadMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [cpDownloadMenuId, setCpDownloadMenuId] = useState<string | null>(null);

  const resolveCVDesign = (cv: CVDocument): DesignConfiguration => {
    if (cv.designOverrides) return cv.designOverrides;
    const tpl = templates.find((t) => t.templateId === cv.selectedTemplateId);
    if (!tpl) return DEFAULT_DESIGN_CONFIG;
    return {
      layout: tpl.layoutConfiguration,
      colors: tpl.colorConfiguration,
      typography: tpl.typographyConfiguration,
      page: tpl.previewConfiguration.page,
    };
  };

  const getTemplateName = (templateId: string) =>
    templates.find((t) => t.templateId === templateId)?.name || 'Custom Design';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#142B4A] tracking-tight">
            Welcome back, {userProfile?.fullName || 'Creator'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage your CV documents, explore 35+ templates, or generate tailored designs with AI.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenProfileSettings}
          className="self-start md:self-auto px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Profile Settings</span>
        </button>
      </div>

      {/* Primary Creation & Studio Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
        <button
          type="button"
          onClick={() => onOpenCreateFlow('scratch')}
          className="text-left p-4 bg-[#142B4A] hover:bg-[#1e3d66] text-white rounded-xl transition-colors flex flex-col justify-between gap-3"
        >
          <FilePlus2 className="w-5 h-5 text-[#93C5FD]" />
          <div>
            <div className="text-sm font-bold">Create New CV</div>
            <div className="text-xs text-slate-300 mt-0.5">Build from scratch</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onOpenCreateFlow('upload')}
          className="text-left p-4 bg-white hover:border-[#2864A6] border border-slate-200 rounded-xl transition-colors flex flex-col justify-between gap-3"
        >
          <FileUp className="w-5 h-5 text-[#2864A6]" />
          <div>
            <div className="text-sm font-bold text-[#142B4A]">Upload Existing CV</div>
            <div className="text-xs text-slate-500 mt-0.5">Extract DOCX or PDF</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onOpenCreateFlow('ai')}
          className="text-left p-4 bg-white hover:border-[#2864A6] border border-slate-200 rounded-xl transition-colors flex flex-col justify-between gap-3"
        >
          <Sparkles className="w-5 h-5 text-[#2864A6]" />
          <div>
            <div className="text-sm font-bold text-[#142B4A]">AI CV Generator</div>
            <div className="text-xs text-slate-500 mt-0.5">Draft from notes</div>
          </div>
        </button>

        <button
          type="button"
          onClick={onBrowseTemplates}
          className="text-left p-4 bg-white hover:border-[#2864A6] border border-slate-200 rounded-xl transition-colors flex flex-col justify-between gap-3"
        >
          <LayoutGrid className="w-5 h-5 text-[#2864A6]" />
          <div>
            <div className="text-sm font-bold text-[#142B4A]">Browse Templates</div>
            <div className="text-xs text-slate-500 mt-0.5">{templates.length} CV designs</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onOpenCoverDesigner()}
          className="text-left p-4 bg-white hover:border-[#2864A6] border border-slate-200 rounded-xl transition-colors flex flex-col justify-between gap-3"
        >
          <BookOpen className="w-5 h-5 text-[#2864A6]" />
          <div>
            <div className="text-sm font-bold text-[#142B4A]">Cover Page Designer</div>
            <div className="text-xs text-slate-500 mt-0.5">25+ portfolio covers</div>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenAIDesigner}
          className="text-left p-4 bg-[#EAF2FB] hover:bg-[#dce9f9] border border-[#2864A6]/25 rounded-xl transition-colors flex flex-col justify-between gap-3"
        >
          <Palette className="w-5 h-5 text-[#142B4A]" />
          <div>
            <div className="text-sm font-bold text-[#142B4A]">AI Design Engine</div>
            <div className="text-xs text-slate-600 mt-0.5">Prompt custom layouts</div>
          </div>
        </button>
      </div>

      {/* My CV Documents */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#142B4A]">
            My CV Documents <span className="text-sm font-medium text-slate-400 tabular-nums">({cvs.length})</span>
          </h2>
          <button
            type="button"
            onClick={onOpenCustomBuilder}
            className="text-xs font-semibold text-[#2864A6] hover:text-[#142B4A] transition-colors"
          >
            + Create My Own Template
          </button>
        </div>

        {cvs.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
            <FileText className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-base font-bold text-[#142B4A]">No CV documents created yet</div>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Start from scratch, upload an existing PDF or DOCX CV to modernize its layout, or generate a structured draft with AI.
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                onClick={() => onOpenCreateFlow('scratch')}
                className="px-4 py-2 text-xs font-semibold bg-[#142B4A] text-white rounded-lg"
              >
                Create First CV
              </button>
              <button
                type="button"
                onClick={() => onOpenCreateFlow('upload')}
                className="px-4 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-lg"
              >
                Upload Existing CV
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {cvs.map((cv) => {
              const design = resolveCVDesign(cv);
              return (
                <div
                  key={cv.cvId}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col hover:border-[#2864A6]/50 transition-colors"
                >
                  <div
                    onClick={() => onEditCV(cv)}
                    className="bg-slate-100 h-56 p-3 flex justify-center items-start overflow-hidden cursor-pointer border-b border-slate-200"
                  >
                    <div className="pointer-events-none select-none">
                      <CVRenderer cv={cv} design={design} scale={0.26} singlePagePreview />
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-[#142B4A] truncate">{cv.cvTitle}</h3>
                      <div className="mt-1 text-xs text-slate-500 flex flex-wrap items-center gap-x-1.5">
                        <span>{getTemplateName(cv.selectedTemplateId)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          Updated {new Date(cv.updatedAt).toLocaleDateString()}
                        </span>
                        {cv.attachedCoverPageId && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-[#2864A6] font-semibold">Cover Page Attached</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 relative">
                      <button
                        type="button"
                        onClick={() => onEditCV(cv)}
                        className="flex-1 py-1.5 px-2.5 text-xs font-semibold bg-[#142B4A] hover:bg-[#1e3d66] text-white rounded-lg inline-flex items-center justify-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenCoverDesigner(cv)}
                        title="Create or Edit Cover Page for this CV"
                        className="p-1.5 text-[#142B4A] bg-[#EAF2FB] hover:bg-[#dce9f9] rounded-lg"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicateCV(cv)}
                        title="Duplicate CV"
                        className="p-1.5 text-slate-600 hover:text-[#142B4A] bg-slate-100 hover:bg-slate-200 rounded-lg"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDownloadMenuId(downloadMenuId === cv.cvId ? null : cv.cvId)
                        }
                        title="Download PDF or DOCX"
                        className="p-1.5 text-slate-600 hover:text-[#142B4A] bg-slate-100 hover:bg-slate-200 rounded-lg"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDeleteId(confirmDeleteId === cv.cvId ? null : cv.cvId)
                        }
                        title="Delete CV"
                        className="p-1.5 text-slate-600 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {downloadMenuId === cv.cvId && (
                        <div className="absolute right-0 bottom-10 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-20 w-56 space-y-1">
                          <button
                            type="button"
                            onClick={async () => {
                              setDownloadMenuId(null);
                              await exportToVectorPDF(cv, design);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                          >
                            Download CV PDF
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setDownloadMenuId(null);
                              await exportToDOCX(cv, design);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                          >
                            Download CV Word (.docx)
                          </button>
                          {(() => {
                            const attachedCp = coverPages.find(
                              (cp) => cp.coverPageId === cv.attachedCoverPageId || cp.cvId === cv.cvId
                            );
                            if (!attachedCp) return null;
                            return (
                              <>
                                <div className="border-t border-slate-100 my-1" />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setDownloadMenuId(null);
                                    await exportCombinedCVWithCoverPDF(attachedCp, cv, design);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg"
                                >
                                  Complete CV + Cover PDF
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setDownloadMenuId(null);
                                    await exportCombinedCVWithCoverDOCX(attachedCp, cv, design);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg"
                                >
                                  Complete CV + Cover (.docx)
                                </button>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {confirmDeleteId === cv.cvId && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between gap-2 text-xs">
                        <span className="text-rose-800 font-medium">Delete this CV?</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-600"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteCV(cv.cvId);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 bg-rose-600 text-white rounded font-semibold"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* My Cover Pages */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#142B4A]">
            My Cover Pages <span className="text-sm font-medium text-slate-400 tabular-nums">({coverPages.length})</span>
          </h2>
          <button
            type="button"
            onClick={() => onOpenCoverDesigner()}
            className="text-xs font-semibold text-[#2864A6] hover:text-[#142B4A] transition-colors"
          >
            + Open Cover Page Designer
          </button>
        </div>

        {coverPages.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-[#142B4A]">Add an Executive Cover Page to Your CV</div>
              <p className="text-xs text-slate-500">
                Choose from 25+ distinct cover page layouts or generate one with AI, attach it to any CV, and export together.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenCoverDesigner()}
              className="px-4 py-2 text-xs font-semibold bg-[#142B4A] text-white rounded-lg shrink-0"
            >
              Design Cover Page
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {coverPages.map((cp) => {
              const linkedCv = cvs.find((c) => c.cvId === cp.cvId || c.attachedCoverPageId === cp.coverPageId);
              return (
                <div
                  key={cp.coverPageId}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col hover:border-[#2864A6]/50 transition-colors"
                >
                  <div
                    onClick={() => onEditCoverPage(cp)}
                    className="bg-slate-100 h-48 p-2.5 flex justify-center items-start overflow-hidden cursor-pointer border-b border-slate-200"
                  >
                    <div className="pointer-events-none select-none">
                      <CoverPageRenderer coverPage={cp} scale={0.16} />
                    </div>
                  </div>
                  <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
                    <div>
                      <h3 className="text-xs font-bold text-[#142B4A] truncate">{cp.title}</h3>
                      <div className="mt-1 text-[11px] text-slate-500 truncate">
                        {cp.pageSize}
                        {linkedCv ? ` · Attached to ${linkedCv.cvTitle}` : ' · Standalone'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 relative">
                      <button
                        type="button"
                        onClick={() => onEditCoverPage(cp)}
                        className="flex-1 py-1.5 px-2 text-xs font-semibold bg-[#142B4A] text-white rounded-lg inline-flex items-center justify-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicateCoverPage(cp)}
                        title="Duplicate Cover Page"
                        className="p-1.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCpDownloadMenuId(cpDownloadMenuId === cp.coverPageId ? null : cp.coverPageId)
                        }
                        title="Download Cover Page"
                        className="p-1.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteCoverPage(cp.coverPageId)}
                        title="Delete Cover Page"
                        className="p-1.5 text-slate-600 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {cpDownloadMenuId === cp.coverPageId && (
                        <div className="absolute right-0 bottom-10 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-20 w-52 space-y-1">
                          <button
                            type="button"
                            onClick={async () => {
                              setCpDownloadMenuId(null);
                              await exportCoverPageToVectorPDF(cp);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                          >
                            Cover Page PDF
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setCpDownloadMenuId(null);
                              await exportCoverPageToDOCX(cp);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                          >
                            Cover Page Word (.docx)
                          </button>
                          {linkedCv && (
                            <button
                              type="button"
                              onClick={async () => {
                                setCpDownloadMenuId(null);
                                await exportCombinedCVWithCoverPDF(
                                  cp,
                                  linkedCv,
                                  resolveCVDesign(linkedCv)
                                );
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg"
                            >
                              Complete CV + Cover PDF
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Bottom Grid: Saved Custom Designs & Recent Activities */}
      <div className="grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#142B4A]">
              Saved Custom Designs <span className="text-xs text-slate-400 tabular-nums">({customDesigns.length})</span>
            </h2>
            <button
              type="button"
              onClick={onOpenCustomBuilder}
              className="px-3 py-1.5 text-xs font-semibold bg-[#EAF2FB] text-[#142B4A] hover:bg-[#dce9f9] rounded-lg"
            >
              Create New Design
            </button>
          </div>

          {customDesigns.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">
              Save designs from the Customization Studio, AI Design Generator, or Create My Own Template to reuse them across multiple CVs.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {customDesigns.map((d) => (
                <div key={d.designId} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg border border-black/10 shrink-0"
                      style={{ backgroundColor: d.designConfiguration.colors.primary }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#142B4A] truncate">{d.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {d.designConfiguration.layout.structure} · {d.designConfiguration.typography.fontFamily}
                        {d.description ? ` · ${d.description}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onApplyCustomDesign(d)}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-[#142B4A] text-white rounded-lg"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteCustomDesign(d.designId)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      aria-label="Delete custom design"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-base font-bold text-[#142B4A]">
            <History className="w-4 h-4 text-[#2864A6]" />
            <span>Recent CV Activities</span>
          </div>

          {!userProfile?.recentActivities?.length ? (
            <p className="text-xs text-slate-500 py-4">
              Your edits, template switches, AI designs, and exports will be logged here.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-64 overflow-y-auto studio-scroll">
              {userProfile.recentActivities.map((act) => (
                <div
                  key={act.id}
                  className="flex items-start justify-between gap-3 text-xs border-b border-slate-100 pb-2 last:border-0"
                >
                  <div>
                    <span className="font-semibold text-[#142B4A]">{act.action}</span>
                    <div className="text-slate-600">{act.targetName}</div>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                    {new Date(act.timestamp).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
