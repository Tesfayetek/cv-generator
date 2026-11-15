import React, { Component, useEffect, useMemo, useState } from 'react';
import { LogOut, MailWarning, RefreshCw, User } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { createNewCVDocument } from './data/presets';
import {
  createCoverPageFromTemplate,
  STARTER_COVER_PAGE_TEMPLATES,
} from './data/coverPageTemplates';
import { STARTER_TEMPLATES } from './data/templates';
import {
  attachCoverPageToCV,
  deleteCoverPageDocument,
  deleteCVDocument,
  deleteCustomDesign,
  logUserActivity,
  saveAIDesignHistoryEntry,
  saveCoverPageDocument,
  saveCustomDesign,
  saveCVDocument,
  subscribeAIDesignHistory,
  subscribeCoverPageTemplates,
  subscribeCustomDesigns,
  subscribePlatformSettings,
  subscribeTemplates,
  subscribeUserCoverPages,
  subscribeUserCVs,
  updateUserProfileDoc,
} from './services/firestoreService';
import type {
  AIDesignHistoryEntry,
  CVDocument,
  CVTemplate,
  CustomDesign,
  DesignConfiguration,
  PlatformSettings,
} from './types/cv';
import type { CoverPageDocument, CoverPageTemplate } from './types/coverPage';
import { AdminDashboardView } from './components/admin/AdminDashboardView';
import { AIDesignGeneratorView } from './components/ai-designer/AIDesignGeneratorView';
import { AuthView } from './components/auth/AuthView';
import { ProfileSettingsModal } from './components/auth/ProfileSettingsModal';
import { CoverPageDesignerView } from './components/cover-page/CoverPageDesignerView';
import { CreateCVFlowsModal } from './components/creation/CreateCVFlowsModal';
import { CustomTemplateBuilderModal } from './components/custom-builder/CustomTemplateBuilderModal';
import { DashboardView } from './components/dashboard/DashboardView';
import { CVStudioView } from './components/studio/CVStudioView';
import { TemplateGalleryView } from './components/templates/TemplateGalleryView';

type AppView = 'dashboard' | 'templates' | 'studio' | 'cover-pages' | 'ai-designer' | 'admin';

class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
            <h2 className="text-lg font-bold text-[#142B4A]">Something went wrong</h2>
            <p className="text-xs text-slate-600 break-words">{this.state.message}</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="px-4 py-2 text-xs font-semibold bg-[#142B4A] text-white rounded-lg"
            >
              Reload Workspace
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppWorkspace: React.FC = () => {
  const {
    firebaseUser,
    userProfile,
    loading,
    isAdmin,
    isVerified,
    resendVerification,
    refreshVerification,
    logout,
    setUserProfileState,
  } = useAuth();

  const [view, setView] = useState<AppView>('dashboard');
  const [publicBrowseTemplates, setPublicBrowseTemplates] = useState(false);

  const [templates, setTemplates] = useState<CVTemplate[]>(STARTER_TEMPLATES);
  const [coverPageTemplates, setCoverPageTemplates] = useState<CoverPageTemplate[]>(
    STARTER_COVER_PAGE_TEMPLATES
  );
  const [cvs, setCvs] = useState<CVDocument[]>([]);
  const [activeCVId, setActiveCVId] = useState<string | null>(null);
  const [coverPages, setCoverPages] = useState<CoverPageDocument[]>([]);
  const [activeCoverPageId, setActiveCoverPageId] = useState<string | null>(null);
  const [customDesigns, setCustomDesigns] = useState<CustomDesign[]>([]);
  const [aiHistory, setAiHistory] = useState<AIDesignHistoryEntry[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>({
    settingId: 'global',
    appName: 'AI CV Studio',
    tagline: 'Create. Customize. Impress.',
    defaultPrimaryColor: '#142B4A',
    defaultSecondaryColor: '#2864A6',
    aiEnabled: true,
    categories: [],
    updatedAt: '',
  });

  const [createFlowModal, setCreateFlowModal] = useState<'scratch' | 'upload' | 'ai' | null>(null);
  const [customBuilderOpen, setCustomBuilderOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState('');

  // Public listeners (templates + cover page templates + branding settings)
  useEffect(() => {
    const unsubTemplates = subscribeTemplates(isAdmin, setTemplates);
    const unsubCoverTemplates = subscribeCoverPageTemplates(isAdmin, setCoverPageTemplates);
    const unsubSettings = subscribePlatformSettings(setSettings);
    return () => {
      unsubTemplates();
      unsubCoverTemplates();
      unsubSettings();
    };
  }, [isAdmin]);

  // Authenticated user-scoped listeners
  useEffect(() => {
    if (!firebaseUser || !isVerified) {
      return;
    }
    const unsubCVs = subscribeUserCVs(firebaseUser.uid, (list) => {
      setCvs(list);
      setActiveCVId((curr) => (curr && list.some((c) => c.cvId === curr) ? curr : list[0]?.cvId || null));
    });
    const unsubCoverPages = subscribeUserCoverPages(firebaseUser.uid, (list) => {
      setCoverPages(list);
      setActiveCoverPageId((curr) =>
        curr && list.some((c) => c.coverPageId === curr) ? curr : list[0]?.coverPageId || null
      );
    });
    const unsubDesigns = subscribeCustomDesigns(firebaseUser.uid, setCustomDesigns);
    const unsubAiHist = subscribeAIDesignHistory(firebaseUser.uid, setAiHistory);
    return () => {
      unsubCVs();
      unsubCoverPages();
      unsubDesigns();
      unsubAiHist();
    };
  }, [firebaseUser, isVerified]);

  const activeCV = useMemo(
    () => cvs.find((c) => c.cvId === activeCVId) || cvs[0] || null,
    [cvs, activeCVId]
  );

  const recordActivity = async (action: string, targetName: string) => {
    if (!firebaseUser || !isVerified || !userProfile) return;
    try {
      const next = await logUserActivity(
        firebaseUser.uid,
        userProfile.recentActivities || [],
        action,
        targetName
      );
      setUserProfileState((prev) => (prev ? { ...prev, recentActivities: next } : prev));
    } catch {
      // non-blocking
    }
  };

  const handleSaveCV = async (cv: CVDocument, isNew = false) => {
    setCvs((prev) => {
      const exists = prev.some((item) => item.cvId === cv.cvId);
      return exists ? prev.map((item) => (item.cvId === cv.cvId ? cv : item)) : [cv, ...prev];
    });
    setActiveCVId(cv.cvId);

    if (firebaseUser && isVerified) {
      await saveCVDocument(cv, isNew);
      await recordActivity(isNew ? 'Created CV' : 'Updated CV', cv.cvTitle);
    }
  };

  const handleCreateCVFromModal = async (newCV: CVDocument) => {
    setCreateFlowModal(null);
    await handleSaveCV(newCV, true);
    setView('studio');
  };

  const handleDuplicateCV = async (cv: CVDocument) => {
    if (!firebaseUser) return;
    const now = new Date().toISOString();
    const copy: CVDocument = {
      ...cv,
      cvId: `cv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      cvTitle: `${cv.cvTitle} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };
    await handleSaveCV(copy, true);
  };

  const handleDeleteCV = async (cvId: string) => {
    setCvs((prev) => prev.filter((c) => c.cvId !== cvId));
    if (activeCVId === cvId) setActiveCVId(null);
    if (firebaseUser && isVerified) {
      await deleteCVDocument(cvId);
    }
  };

  const handleSaveCoverPage = async (cp: CoverPageDocument, isNew = false) => {
    setCoverPages((prev) => {
      const exists = prev.some((item) => item.coverPageId === cp.coverPageId);
      return exists
        ? prev.map((item) => (item.coverPageId === cp.coverPageId ? cp : item))
        : [cp, ...prev];
    });
    setActiveCoverPageId(cp.coverPageId);
    if (firebaseUser && isVerified) {
      await saveCoverPageDocument(cp, isNew);
      await recordActivity(isNew ? 'Created Cover Page' : 'Updated Cover Page', cp.title);
    }
  };

  const handleDuplicateCoverPage = async (cp: CoverPageDocument) => {
    if (!firebaseUser) return;
    const now = new Date().toISOString();
    const copy: CoverPageDocument = {
      ...JSON.parse(JSON.stringify(cp)),
      coverPageId: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: `${cp.title} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };
    await handleSaveCoverPage(copy, true);
  };

  const handleDeleteCoverPage = async (coverPageId: string) => {
    setCoverPages((prev) => prev.filter((c) => c.coverPageId !== coverPageId));
    if (activeCoverPageId === coverPageId) setActiveCoverPageId(null);
    if (firebaseUser && isVerified) {
      await deleteCoverPageDocument(coverPageId);
    }
  };

  const handleAttachCoverPageToCV = async (cvId: string, coverPageId: string) => {
    setCvs((prev) =>
      prev.map((c) => (c.cvId === cvId ? { ...c, attachedCoverPageId: coverPageId } : c))
    );
    if (coverPageId) {
      setCoverPages((prev) =>
        prev.map((cp) => (cp.coverPageId === coverPageId ? { ...cp, cvId } : cp))
      );
    }
    if (firebaseUser && isVerified) {
      await attachCoverPageToCV(cvId, coverPageId);
    }
  };

  const handleOpenCoverDesignerForCV = async (forCV?: CVDocument) => {
    if (!firebaseUser) return;
    if (forCV) {
      const existing = coverPages.find(
        (cp) =>
          (forCV.attachedCoverPageId && cp.coverPageId === forCV.attachedCoverPageId) ||
          cp.cvId === forCV.cvId
      );
      if (existing) {
        setActiveCoverPageId(existing.coverPageId);
        setView('cover-pages');
        return;
      }
      const starterTpl = coverPageTemplates[0] || STARTER_COVER_PAGE_TEMPLATES[0];
      const created = createCoverPageFromTemplate(firebaseUser.uid, starterTpl, forCV);
      await handleSaveCoverPage(created, true);
      await handleAttachCoverPageToCV(forCV.cvId, created.coverPageId);
    }
    setView('cover-pages');
  };

  const handleUseOrCustomizeTemplate = async (template: CVTemplate, openStudioAfter: boolean) => {
    const templateDesign: DesignConfiguration = {
      layout: template.layoutConfiguration,
      colors: template.colorConfiguration,
      typography: template.typographyConfiguration,
      page: template.previewConfiguration.page,
    };

    if (activeCV) {
      // Apply design without losing existing CV information
      const updated: CVDocument = {
        ...activeCV,
        selectedTemplateId: template.templateId,
        designOverrides: templateDesign,
        updatedAt: new Date().toISOString(),
      };
      await handleSaveCV(updated, false);
      if (openStudioAfter || true) {
        setView('studio');
      }
    } else if (firebaseUser) {
      const created = createNewCVDocument(
        firebaseUser.uid,
        template.templateId,
        `${template.name} CV`,
        templateDesign,
        true
      );
      await handleSaveCV(created, true);
      setView('studio');
    }
  };

  const handleToggleFavorite = async (templateId: string) => {
    if (!firebaseUser || !userProfile) return;
    const curr = userProfile.favoriteTemplateIds || [];
    const next = curr.includes(templateId)
      ? curr.filter((id) => id !== templateId)
      : [...curr, templateId].slice(0, 50);

    setUserProfileState({ ...userProfile, favoriteTemplateIds: next });
    if (isVerified) {
      await updateUserProfileDoc(firebaseUser.uid, { favoriteTemplateIds: next });
    }
  };

  const handleSaveCustomDesign = async (
    name: string,
    description: string,
    config: DesignConfiguration,
    applyImmediately = false
  ) => {
    if (!firebaseUser) return;
    const now = new Date().toISOString();
    const design: CustomDesign = {
      designId: `dsn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: firebaseUser.uid,
      name,
      description,
      designConfiguration: config,
      createdAt: now,
      updatedAt: now,
    };
    setCustomDesigns((prev) => [design, ...prev]);
    if (isVerified) {
      await saveCustomDesign(design, true);
      await recordActivity('Saved Custom Design', name);
    }

    if (applyImmediately) {
      if (activeCV) {
        await handleSaveCV({ ...activeCV, designOverrides: config }, false);
      } else {
        const created = createNewCVDocument(
          firebaseUser.uid,
          'tpl_classic_executive',
          `${name} CV`,
          config,
          true
        );
        await handleSaveCV(created, true);
      }
      setView('studio');
    }
  };

  const handleApplyCustomDesignToActiveOrNew = async (design: CustomDesign) => {
    if (!firebaseUser) return;
    if (activeCV) {
      await handleSaveCV(
        { ...activeCV, designOverrides: design.designConfiguration, updatedAt: new Date().toISOString() },
        false
      );
    } else {
      const created = createNewCVDocument(
        firebaseUser.uid,
        'tpl_classic_executive',
        `${design.name} CV`,
        design.designConfiguration,
        true
      );
      await handleSaveCV(created, true);
    }
    setView('studio');
  };

  const handleSaveAIHistory = async (
    prompt: string,
    rationale: string,
    config: DesignConfiguration
  ) => {
    if (!firebaseUser) return;
    const entry: AIDesignHistoryEntry = {
      historyId: `aid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId: firebaseUser.uid,
      cvId: activeCV?.cvId,
      prompt,
      rationale,
      generatedConfiguration: config,
      createdAt: new Date().toISOString(),
    };
    setAiHistory((prev) => [entry, ...prev]);
    if (isVerified) {
      await saveAIDesignHistoryEntry(entry);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-sm font-semibold text-[#142B4A]">Loading {settings.appName}...</div>
      </div>
    );
  }

  if (!firebaseUser) {
    if (publicBrowseTemplates) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
          <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-8">
            <button
              onClick={() => setPublicBrowseTemplates(false)}
              className="text-lg font-bold tracking-tight text-[#142B4A] whitespace-nowrap shrink-0 font-display"
            >
              {settings.appName}
            </button>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <span className="text-[#142B4A] font-semibold whitespace-nowrap">Template Gallery</span>
            </nav>
            <button
              onClick={() => setPublicBrowseTemplates(false)}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#142B4A] rounded-lg whitespace-nowrap shrink-0"
            >
              Sign In to Customize
            </button>
          </header>
          <TemplateGalleryView
            templates={templates}
            favoriteIds={[]}
            activeCV={null}
            onToggleFavorite={() => setPublicBrowseTemplates(false)}
            onUseDesign={() => setPublicBrowseTemplates(false)}
            onCustomizeDesign={() => setPublicBrowseTemplates(false)}
          />
        </div>
      );
    }

    return (
      <AuthView
        appName={settings.appName}
        tagline={settings.tagline}
        onBrowseTemplatesPublic={() => setPublicBrowseTemplates(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="no-print bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8 sticky top-0 z-30">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => setView('dashboard')}
          className="text-lg font-bold tracking-tight text-[#142B4A] whitespace-nowrap shrink-0 font-display"
        >
          {settings.appName}
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav className="flex items-center gap-5 sm:gap-7 text-xs sm:text-sm font-semibold overflow-x-auto">
          {(
            [
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'templates', label: 'Templates' },
              { id: 'studio', label: 'CV Studio' },
              { id: 'cover-pages', label: 'Cover Pages' },
              { id: 'ai-designer', label: 'AI Designer' },
              ...(isAdmin ? [{ id: 'admin', label: 'Admin' }] : []),
            ] as Array<{ id: AppView; label: string }>
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === 'studio' && !activeCV) {
                  setCreateFlowModal('scratch');
                } else {
                  setView(item.id);
                }
              }}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                view === item.id
                  ? 'border-[#142B4A] text-[#142B4A]'
                  : 'border-transparent text-slate-600 hover:text-[#142B4A]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Single Primary Action + Account */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setCreateFlowModal('scratch')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#142B4A] hover:bg-[#1e3d66] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            New CV
          </button>
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            className="p-2 text-slate-600 hover:text-[#142B4A] hover:bg-slate-100 rounded-lg border border-slate-200"
            title="Profile Settings"
            aria-label="Profile Settings"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Email Verification Reminder Banner for Email/Password Registrations */}
      {!isVerified && (
        <div className="no-print bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <MailWarning className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Please verify your email ({firebaseUser.email}) to sync CVs to cloud storage. You can edit and export locally in the meantime.
            </span>
          </div>
          <div className="flex items-center gap-2">
            {verifyNotice && <span className="font-semibold text-emerald-700">{verifyNotice}</span>}
            <button
              type="button"
              onClick={async () => {
                await resendVerification();
                setVerifyNotice('Verification email resent.');
              }}
              className="px-2.5 py-1 bg-white border border-amber-300 rounded font-semibold hover:bg-amber-100"
            >
              Resend Email
            </button>
            <button
              type="button"
              onClick={async () => {
                const ok = await refreshVerification();
                setVerifyNotice(ok ? 'Verified!' : 'Not verified yet — check your inbox.');
              }}
              className="px-2.5 py-1 bg-amber-800 text-white rounded font-semibold inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>I've Verified</span>
            </button>
            <button
              type="button"
              onClick={logout}
              className="px-2 py-1 text-amber-800 hover:underline inline-flex items-center gap-1"
            >
              <LogOut className="w-3 h-3" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1">
        {view === 'dashboard' && (
          <DashboardView
            userProfile={userProfile}
            cvs={cvs}
            templates={templates}
            customDesigns={customDesigns}
            coverPages={coverPages}
            onOpenCreateFlow={(method) => setCreateFlowModal(method)}
            onBrowseTemplates={() => setView('templates')}
            onOpenAIDesigner={() => setView('ai-designer')}
            onOpenCustomBuilder={() => setCustomBuilderOpen(true)}
            onOpenCoverDesigner={(cv) => handleOpenCoverDesignerForCV(cv)}
            onEditCV={(cv) => {
              setActiveCVId(cv.cvId);
              setView('studio');
            }}
            onDuplicateCV={handleDuplicateCV}
            onDeleteCV={handleDeleteCV}
            onEditCoverPage={(cp) => {
              setActiveCoverPageId(cp.coverPageId);
              setView('cover-pages');
            }}
            onDuplicateCoverPage={handleDuplicateCoverPage}
            onDeleteCoverPage={handleDeleteCoverPage}
            onApplyCustomDesign={handleApplyCustomDesignToActiveOrNew}
            onDeleteCustomDesign={async (id) => {
              setCustomDesigns((prev) => prev.filter((d) => d.designId !== id));
              if (isVerified) await deleteCustomDesign(id);
            }}
            onOpenProfileSettings={() => setProfileModalOpen(true)}
          />
        )}

        {view === 'templates' && (
          <TemplateGalleryView
            templates={templates}
            favoriteIds={userProfile?.favoriteTemplateIds || []}
            activeCV={activeCV}
            onToggleFavorite={handleToggleFavorite}
            onUseDesign={(tpl) => handleUseOrCustomizeTemplate(tpl, false)}
            onCustomizeDesign={(tpl) => handleUseOrCustomizeTemplate(tpl, true)}
          />
        )}

        {view === 'studio' && activeCV && (
          <CVStudioView
            cv={activeCV}
            templates={templates}
            coverPages={coverPages}
            aiEnabled={settings.aiEnabled}
            onSaveCV={(updated) => handleSaveCV(updated, false)}
            onSaveCustomDesign={(name, desc, cfg) =>
              handleSaveCustomDesign(name, desc, cfg, false)
            }
            onOpenAIDesigner={() => setView('ai-designer')}
            onOpenCoverDesignerForCV={(cv) => handleOpenCoverDesignerForCV(cv)}
            onAttachCoverPage={handleAttachCoverPageToCV}
          />
        )}

        {view === 'cover-pages' && (
          <CoverPageDesignerView
            userId={firebaseUser.uid}
            coverPages={coverPages}
            activeCoverPageId={activeCoverPageId}
            onSelectCoverPageId={setActiveCoverPageId}
            coverPageTemplates={coverPageTemplates}
            cvs={cvs}
            cvTemplates={templates}
            aiEnabled={settings.aiEnabled}
            onSaveCoverPage={handleSaveCoverPage}
            onDeleteCoverPage={handleDeleteCoverPage}
            onAttachToCV={handleAttachCoverPageToCV}
          />
        )}

        {view === 'ai-designer' && (
          <AIDesignGeneratorView
            activeCV={activeCV}
            history={aiHistory}
            aiEnabled={settings.aiEnabled}
            onSaveHistoryEntry={handleSaveAIHistory}
            onApplyDesignToCV={async (config) => {
              if (activeCV) {
                await handleSaveCV({ ...activeCV, designOverrides: config }, false);
              } else if (firebaseUser) {
                const created = createNewCVDocument(
                  firebaseUser.uid,
                  'tpl_classic_executive',
                  'AI Designed CV',
                  config,
                  true
                );
                await handleSaveCV(created, true);
              }
            }}
            onSaveCustomDesign={(name, desc, cfg) =>
              handleSaveCustomDesign(name, desc, cfg, false)
            }
            onOpenStudio={() => setView('studio')}
          />
        )}

        {view === 'admin' && isAdmin && (
          <AdminDashboardView
            templates={templates}
            coverPageTemplates={coverPageTemplates}
            settings={settings}
          />
        )}
      </main>

      {/* Modals */}
      {createFlowModal && (
        <CreateCVFlowsModal
          initialMethod={createFlowModal}
          userId={firebaseUser.uid}
          templates={templates}
          onClose={() => setCreateFlowModal(null)}
          onCreateCV={handleCreateCVFromModal}
        />
      )}

      {customBuilderOpen && (
        <CustomTemplateBuilderModal
          onClose={() => setCustomBuilderOpen(false)}
          onSaveCustomDesign={handleSaveCustomDesign}
        />
      )}

      {profileModalOpen && (
        <ProfileSettingsModal onClose={() => setProfileModalOpen(false)} />
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppWorkspace />
      </AuthProvider>
    </ErrorBoundary>
  );
}
