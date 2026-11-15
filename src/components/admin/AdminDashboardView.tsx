import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Plus,
  Save,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import { COLOR_PRESETS, CV_FONT_OPTIONS, DEFAULT_DESIGN_CONFIG } from '../../data/presets';
import {
  COVER_COLOR_SCHEMES,
  COVER_PAGE_CATEGORIES,
  COVER_PAGE_FONT_OPTIONS,
  STARTER_COVER_PAGE_TEMPLATES,
} from '../../data/coverPageTemplates';
import {
  deleteCoverPageTemplateAdmin,
  deleteTemplateAdmin,
  listUsersAdmin,
  savePlatformSettingsAdmin,
  seedStarterCoverPageTemplatesIfAdmin,
  seedStarterTemplatesIfAdmin,
  setUserRoleAdmin,
  upsertCoverPageTemplateAdmin,
  upsertTemplateAdmin,
} from '../../services/firestoreService';
import type {
  CVTemplate,
  PlatformSettings,
  TemplateCategory,
  UserProfile,
} from '../../types/cv';
import type {
  CoverPageCategory,
  CoverPageFontFamily,
  CoverPageSize,
  CoverPageTemplate,
} from '../../types/coverPage';

interface AdminDashboardViewProps {
  templates: CVTemplate[];
  coverPageTemplates: CoverPageTemplate[];
  settings: PlatformSettings;
}

const ALL_CATEGORIES: TemplateCategory[] = [
  'Classic Professional',
  'Modern Elegant',
  'Executive and Leadership',
  'NGO and International Development',
  'Academic and Research',
  'Creative and Digital',
  'Entry-Level',
];

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  templates,
  coverPageTemplates,
  settings,
}) => {
  const [tab, setTab] = useState<'templates' | 'cover-templates' | 'users' | 'settings'>('templates');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Template editor state
  const [editingTpl, setEditingTpl] = useState<CVTemplate | null>(null);
  const [isNewTpl, setIsNewTpl] = useState(false);

  // Cover page template editor state
  const [editingCoverTpl, setEditingCoverTpl] = useState<CoverPageTemplate | null>(null);
  const [isNewCoverTpl, setIsNewCoverTpl] = useState(false);

  // Settings state
  const [localSettings, setLocalSettings] = useState<PlatformSettings>(settings);
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const list = await listUsersAdmin();
      setUsers(list);
    } catch (err: any) {
      setError(err?.message || 'Could not load users.');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (tab === 'users') {
      loadUsers();
    }
  }, [tab]);

  const openNewTemplate = () => {
    const id = `tpl_custom_${Date.now()}`;
    setIsNewTpl(true);
    setEditingTpl({
      templateId: id,
      name: 'New Executive Template',
      category: 'Modern Elegant',
      profession: 'Corporate & Strategy',
      description: 'Database-driven template created from Administrator Console.',
      atsFriendly: true,
      tier: 'free',
      popularityScore: 85,
      layoutConfiguration: { ...DEFAULT_DESIGN_CONFIG.layout },
      colorConfiguration: { ...COLOR_PRESETS[0] },
      typographyConfiguration: { ...DEFAULT_DESIGN_CONFIG.typography },
      previewConfiguration: {
        page: { ...DEFAULT_DESIGN_CONFIG.page },
        defaultSectionOrder: ['summary', 'experience', 'education', 'skills', 'certifications', 'languages'],
        sampleProfileKey: 'executive',
      },
      status: 'published',
    });
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTpl) return;
    setError('');
    setNotice('');
    try {
      await upsertTemplateAdmin(editingTpl, isNewTpl);
      setNotice(`Template "${editingTpl.name}" saved to Firestore.`);
      setEditingTpl(null);
    } catch (err: any) {
      setError(err?.message || 'Failed saving template.');
    }
  };

  const handleTogglePublish = async (tpl: CVTemplate) => {
    setError('');
    try {
      await upsertTemplateAdmin(
        { ...tpl, status: tpl.status === 'published' ? 'draft' : 'published' },
        false
      );
      setNotice(`Updated "${tpl.name}" visibility.`);
    } catch (err: any) {
      setError(err?.message || 'Failed updating template status.');
    }
  };

  const publishedCount = templates.filter((t) => t.status === 'published').length;
  const atsCount = templates.filter((t) => t.atsFriendly).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#2864A6] uppercase tracking-wider">
            <Shield className="w-4 h-4" />
            <span>Administrator Control Center</span>
          </div>
          <h1 className="text-2xl font-bold text-[#142B4A] mt-1">
            Platform, Template & User Management
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const count = await seedStarterTemplatesIfAdmin();
              setNotice(
                count > 0
                  ? `Synced ${count} starter templates into Firestore.`
                  : 'All 35 starter templates are already synced in Firestore.'
              );
            }}
            className="px-3.5 py-2 text-xs font-semibold bg-[#EAF2FB] text-[#142B4A] hover:bg-[#dce9f9] rounded-lg"
          >
            Sync 35 Starter Templates to DB
          </button>
          <button
            type="button"
            onClick={openNewTemplate}
            className="px-4 py-2 text-xs font-semibold bg-[#142B4A] text-white hover:bg-[#1e3d66] rounded-lg inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Template</span>
          </button>
        </div>
      </div>

      {/* Platform Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-medium">Total Templates</div>
          <div className="text-2xl font-bold text-[#142B4A] mt-1 tabular-nums">{templates.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-medium">Published Templates</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">{publishedCount}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-medium">ATS-Friendly Templates</div>
          <div className="text-2xl font-bold text-[#2864A6] mt-1 tabular-nums">{atsCount}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-medium">AI Engine Status</div>
          <div className="text-lg font-bold text-[#142B4A] mt-1">
            {localSettings.aiEnabled ? 'Enabled' : 'Paused'}
          </div>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Admin Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-fit">
        {[
          { id: 'templates', label: `CV Templates (${templates.length})` },
          { id: 'cover-templates', label: `Cover Page Templates (${coverPageTemplates.length})` },
          { id: 'users', label: 'Manage Users' },
          { id: 'settings', label: 'Branding & AI Settings' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              tab === t.id ? 'bg-white text-[#142B4A] shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: TEMPLATES */}
      {tab === 'templates' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-3 px-4">Template</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Layout & Font</th>
                  <th className="py-3 px-4">ATS</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {templates.map((tpl) => (
                  <tr key={tpl.templateId} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: tpl.colorConfiguration.primary }}
                        />
                        <div>
                          <div className="font-bold text-[#142B4A]">{tpl.name}</div>
                          <div className="text-[11px] text-slate-400">{tpl.profession}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{tpl.category}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {tpl.layoutConfiguration.structure} · {tpl.typographyConfiguration.fontFamily}
                    </td>
                    <td className="py-3 px-4">
                      {tpl.atsFriendly ? (
                        <span className="text-emerald-700 font-semibold">Yes</span>
                      ) : (
                        <span className="text-slate-500">Visual</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleTogglePublish(tpl)}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                          tpl.status === 'published'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {tpl.status === 'published' ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewTpl(false);
                          setEditingTpl(tpl);
                        }}
                        className="p-1.5 text-slate-600 hover:text-[#142B4A] inline-flex"
                        title="Edit template"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteTemplateAdmin(tpl.templateId);
                          setNotice(`Deleted template "${tpl.name}".`);
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-600 inline-flex"
                        title="Delete template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: COVER PAGE TEMPLATES */}
      {tab === 'cover-templates' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-600">
              Manage official Cover Page templates, default dimensions, typography, featured flags, and publication status.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const count = await seedStarterCoverPageTemplatesIfAdmin();
                  setNotice(
                    count > 0
                      ? `Synced ${count} starter cover page templates into Firestore.`
                      : `All ${STARTER_COVER_PAGE_TEMPLATES.length} starter cover page templates are already synced.`
                  );
                }}
                className="px-3.5 py-2 text-xs font-semibold bg-[#EAF2FB] text-[#142B4A] hover:bg-[#dce9f9] rounded-lg"
              >
                Sync 25 Cover Templates to DB
              </button>
              <button
                type="button"
                onClick={() => {
                  const base = STARTER_COVER_PAGE_TEMPLATES[0];
                  setIsNewCoverTpl(true);
                  setEditingCoverTpl({
                    ...JSON.parse(JSON.stringify(base)),
                    templateId: `cp_tpl_${Date.now()}`,
                    templateName: 'New Executive Cover Template',
                    status: 'published',
                  });
                }}
                className="px-3.5 py-2 text-xs font-semibold bg-[#142B4A] text-white hover:bg-[#1e3d66] rounded-lg inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Cover Template</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase">
                    <th className="py-3 px-4">Cover Template</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Typography & Size</th>
                    <th className="py-3 px-4">Featured</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {coverPageTemplates.map((ct) => (
                    <tr key={ct.templateId} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                            style={{ backgroundColor: ct.designConfiguration.primaryColor }}
                          />
                          <div>
                            <div className="font-bold text-[#142B4A]">{ct.templateName}</div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[260px]">
                              {ct.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{ct.category}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {ct.designConfiguration.headingFontFamily} · {ct.previewConfiguration.defaultPageSize}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={async () => {
                            await upsertCoverPageTemplateAdmin(
                              {
                                ...ct,
                                previewConfiguration: {
                                  ...ct.previewConfiguration,
                                  featured: !ct.previewConfiguration.featured,
                                },
                              },
                              false
                            );
                            setNotice(`Updated featured status for "${ct.templateName}".`);
                          }}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            ct.previewConfiguration.featured
                              ? 'bg-[#EAF2FB] text-[#142B4A]'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {ct.previewConfiguration.featured ? 'Featured' : 'Standard'}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={async () => {
                            const nextStatus =
                              ct.status === 'published'
                                ? 'draft'
                                : ct.status === 'draft'
                                ? 'archived'
                                : 'published';
                            await upsertCoverPageTemplateAdmin({ ...ct, status: nextStatus }, false);
                            setNotice(`Set "${ct.templateName}" to ${nextStatus}.`);
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold capitalize ${
                            ct.status === 'published'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : ct.status === 'archived'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {ct.status}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsNewCoverTpl(false);
                            setEditingCoverTpl(JSON.parse(JSON.stringify(ct)));
                          }}
                          className="p-1.5 text-slate-600 hover:text-[#142B4A] inline-flex"
                          title="Edit cover template"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteCoverPageTemplateAdmin(ct.templateId);
                            setNotice(`Deleted cover template "${ct.templateName}".`);
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-600 inline-flex"
                          title="Delete cover template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: USERS */}
      {tab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-[#142B4A]">
              <Users className="w-4 h-4 text-[#2864A6]" />
              <span>Registered Users ({users.length})</span>
            </div>
            <button
              type="button"
              onClick={loadUsers}
              className="text-xs font-semibold text-[#2864A6] hover:underline"
            >
              Refresh
            </button>
          </div>

          {loadingUsers ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading users...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase">
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Joined</th>
                    <th className="py-3 px-4 text-right">Access Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.userId}>
                      <td className="py-3 px-4 font-semibold text-[#142B4A]">{u.fullName}</td>
                      <td className="py-3 px-4 text-slate-600">{u.email}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold uppercase text-[11px] text-[#2864A6]">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 tabular-nums">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            const nextRole = u.role === 'admin' ? 'user' : 'admin';
                            await setUserRoleAdmin(u.userId, u.email, nextRole);
                            setUsers((prev) =>
                              prev.map((item) =>
                                item.userId === u.userId ? { ...item, role: nextRole } : item
                              )
                            );
                            setNotice(`Updated ${u.email} role to ${nextRole}.`);
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold border border-slate-200 rounded-lg hover:bg-slate-50"
                        >
                          {u.role === 'admin' ? 'Revoke Admin' : 'Grant Admin'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: PLATFORM SETTINGS */}
      {tab === 'settings' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-2xl space-y-4">
          <h2 className="text-base font-bold text-[#142B4A]">Application Branding & AI Controls</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Application Name</label>
              <input
                type="text"
                value={localSettings.appName}
                onChange={(e) => setLocalSettings({ ...localSettings, appName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tagline</label>
              <input
                type="text"
                value={localSettings.tagline}
                onChange={(e) => setLocalSettings({ ...localSettings, tagline: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Default Primary Color</label>
              <input
                type="color"
                value={localSettings.defaultPrimaryColor}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, defaultPrimaryColor: e.target.value })
                }
                className="h-9 w-24 border border-slate-300 rounded-lg p-1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Default Secondary Color</label>
              <input
                type="color"
                value={localSettings.defaultSecondaryColor}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, defaultSecondaryColor: e.target.value })
                }
                className="h-9 w-24 border border-slate-300 rounded-lg p-1"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 pt-2">
            <input
              type="checkbox"
              checked={localSettings.aiEnabled}
              onChange={(e) => setLocalSettings({ ...localSettings, aiEnabled: e.target.checked })}
            />
            <span>Enable AI Content & Design Generation Engine</span>
          </label>

          <button
            type="button"
            onClick={async () => {
              await savePlatformSettingsAdmin(localSettings);
              setNotice('Platform settings saved to Firestore.');
            }}
            className="px-5 py-2.5 bg-[#142B4A] hover:bg-[#1e3d66] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Platform Settings</span>
          </button>
        </div>
      )}

      {/* Template Edit / Create Modal */}
      {editingTpl && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveTemplate}
            className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto studio-scroll"
          >
            <h3 className="text-lg font-bold text-[#142B4A]">
              {isNewTpl ? 'Create New Official Template' : `Edit Template: ${editingTpl.name}`}
            </h3>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Template Name *</label>
                <input
                  type="text"
                  required
                  value={editingTpl.name}
                  onChange={(e) => setEditingTpl({ ...editingTpl, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={editingTpl.category}
                  onChange={(e) =>
                    setEditingTpl({ ...editingTpl, category: e.target.value as TemplateCategory })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Profession</label>
                <input
                  type="text"
                  value={editingTpl.profession}
                  onChange={(e) => setEditingTpl({ ...editingTpl, profession: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Layout Structure</label>
                <select
                  value={editingTpl.layoutConfiguration.structure}
                  onChange={(e) =>
                    setEditingTpl({
                      ...editingTpl,
                      layoutConfiguration: {
                        ...editingTpl.layoutConfiguration,
                        structure: e.target.value as any,
                      },
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="one-column">One-Column</option>
                  <option value="two-column-balanced">Two-Column Balanced</option>
                  <option value="sidebar-left">Sidebar Left</option>
                  <option value="sidebar-right">Sidebar Right</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Body Font</label>
                <select
                  value={editingTpl.typographyConfiguration.fontFamily}
                  onChange={(e) =>
                    setEditingTpl({
                      ...editingTpl,
                      typographyConfiguration: {
                        ...editingTpl.typographyConfiguration,
                        fontFamily: e.target.value as any,
                      },
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {CV_FONT_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Color Preset</label>
                <select
                  value={editingTpl.colorConfiguration.presetName}
                  onChange={(e) => {
                    const p = COLOR_PRESETS.find((c) => c.presetName === e.target.value);
                    if (p) setEditingTpl({ ...editingTpl, colorConfiguration: p });
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {COLOR_PRESETS.map((c) => (
                    <option key={c.presetName} value={c.presetName}>
                      {c.presetName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <textarea
                rows={2}
                value={editingTpl.description}
                onChange={(e) => setEditingTpl({ ...editingTpl, description: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={editingTpl.atsFriendly}
                  onChange={(e) => setEditingTpl({ ...editingTpl, atsFriendly: e.target.checked })}
                />
                <span>ATS-Friendly</span>
              </label>
              <select
                value={editingTpl.status}
                onChange={(e) =>
                  setEditingTpl({ ...editingTpl, status: e.target.value as 'published' | 'draft' })
                }
                className="px-2.5 py-1 border border-slate-300 rounded-lg bg-white"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
              <select
                value={editingTpl.tier}
                onChange={(e) =>
                  setEditingTpl({ ...editingTpl, tier: e.target.value as 'free' | 'premium' })
                }
                className="px-2.5 py-1 border border-slate-300 rounded-lg bg-white"
              >
                <option value="free">Free</option>
                <option value="premium">Premium</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingTpl(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#142B4A] rounded-lg"
              >
                Save Template
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cover Page Template Edit / Create Modal */}
      {editingCoverTpl && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              try {
                await upsertCoverPageTemplateAdmin(editingCoverTpl, isNewCoverTpl);
                setNotice(`Cover page template "${editingCoverTpl.templateName}" saved.`);
                setEditingCoverTpl(null);
              } catch (err: any) {
                setError(err?.message || 'Failed saving cover page template.');
              }
            }}
            className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto studio-scroll"
          >
            <h3 className="text-lg font-bold text-[#142B4A]">
              {isNewCoverTpl
                ? 'Create Official Cover Page Template'
                : `Edit Cover Template: ${editingCoverTpl.templateName}`}
            </h3>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Template Name *</label>
                <input
                  type="text"
                  required
                  value={editingCoverTpl.templateName}
                  onChange={(e) =>
                    setEditingCoverTpl({ ...editingCoverTpl, templateName: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={editingCoverTpl.category}
                  onChange={(e) =>
                    setEditingCoverTpl({
                      ...editingCoverTpl,
                      category: e.target.value as CoverPageCategory,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {COVER_PAGE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Heading Font</label>
                <select
                  value={editingCoverTpl.designConfiguration.headingFontFamily}
                  onChange={(e) =>
                    setEditingCoverTpl({
                      ...editingCoverTpl,
                      designConfiguration: {
                        ...editingCoverTpl.designConfiguration,
                        headingFontFamily: e.target.value as CoverPageFontFamily,
                      },
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {COVER_PAGE_FONT_OPTIONS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Color Scheme</label>
                <select
                  value={editingCoverTpl.designConfiguration.colorSchemeName}
                  onChange={(e) => {
                    const s = COVER_COLOR_SCHEMES.find((c) => c.name === e.target.value);
                    if (s) {
                      setEditingCoverTpl({
                        ...editingCoverTpl,
                        designConfiguration: {
                          ...editingCoverTpl.designConfiguration,
                          colorSchemeName: s.name,
                          primaryColor: s.primary,
                          secondaryColor: s.secondary,
                          accentColor: s.accent,
                          textColor: s.text,
                          mutedTextColor: s.muted,
                        },
                      });
                    }
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {COVER_COLOR_SCHEMES.map((s) => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Default Paper Size</label>
                <select
                  value={editingCoverTpl.previewConfiguration.defaultPageSize}
                  onChange={(e) =>
                    setEditingCoverTpl({
                      ...editingCoverTpl,
                      previewConfiguration: {
                        ...editingCoverTpl.previewConfiguration,
                        defaultPageSize: e.target.value as CoverPageSize,
                      },
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="A4">A4</option>
                  <option value="LETTER">US Letter</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Preview Image URL (Optional)</label>
                <input
                  type="text"
                  value={editingCoverTpl.previewConfiguration.previewImageUrl || ''}
                  onChange={(e) =>
                    setEditingCoverTpl({
                      ...editingCoverTpl,
                      previewConfiguration: {
                        ...editingCoverTpl.previewConfiguration,
                        previewImageUrl: e.target.value,
                      },
                    })
                  }
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <textarea
                rows={2}
                value={editingCoverTpl.description}
                onChange={(e) =>
                  setEditingCoverTpl({ ...editingCoverTpl, description: e.target.value })
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={Boolean(editingCoverTpl.previewConfiguration.featured)}
                  onChange={(e) =>
                    setEditingCoverTpl({
                      ...editingCoverTpl,
                      previewConfiguration: {
                        ...editingCoverTpl.previewConfiguration,
                        featured: e.target.checked,
                      },
                    })
                  }
                />
                <span>Featured Template</span>
              </label>
              <select
                value={editingCoverTpl.status}
                onChange={(e) =>
                  setEditingCoverTpl({
                    ...editingCoverTpl,
                    status: e.target.value as 'published' | 'draft' | 'archived',
                  })
                }
                className="px-2.5 py-1 border border-slate-300 rounded-lg bg-white"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingCoverTpl(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#142B4A] rounded-lg"
              >
                Save Cover Template
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
