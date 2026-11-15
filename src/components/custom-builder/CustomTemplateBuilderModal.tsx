import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import {
  COLOR_PRESETS,
  CV_FONT_OPTIONS,
  DEFAULT_DESIGN_CONFIG,
  SAMPLE_CV_PROFILES,
} from '../../data/presets';
import type { CVDocument, DesignConfiguration } from '../../types/cv';
import { CVRenderer } from '../cv/CVRenderer';

interface CustomTemplateBuilderModalProps {
  onClose: () => void;
  onSaveCustomDesign: (
    name: string,
    description: string,
    config: DesignConfiguration,
    applyImmediately: boolean
  ) => Promise<void>;
}

export const CustomTemplateBuilderModal: React.FC<CustomTemplateBuilderModalProps> = ({
  onClose,
  onSaveCustomDesign,
}) => {
  const [name, setName] = useState('My Custom Template');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState<DesignConfiguration>({
    ...DEFAULT_DESIGN_CONFIG,
    layout: { ...DEFAULT_DESIGN_CONFIG.layout },
    colors: { ...COLOR_PRESETS[0] },
    typography: { ...DEFAULT_DESIGN_CONFIG.typography },
    page: { ...DEFAULT_DESIGN_CONFIG.page },
  });
  const [saving, setSaving] = useState(false);

  const sampleCV: CVDocument = {
    ...SAMPLE_CV_PROFILES.executive,
    cvId: 'custom_builder_preview',
    userId: 'preview',
    selectedTemplateId: 'custom',
    createdAt: '',
    updatedAt: '',
  };

  const handleSave = async (applyImmediately: boolean) => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSaveCustomDesign(name.trim(), description.trim(), config, applyImmediately);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#142B4A]">Create My Own Template</h2>
            <p className="text-xs text-slate-500">
              Start from a blank design blueprint, configure columns, fonts, colors, headings, and decorative elements, and save it to your account.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 grid lg:grid-cols-12 min-h-0 overflow-hidden">
          {/* Controls */}
          <div className="lg:col-span-5 p-5 overflow-y-auto border-r border-slate-200 space-y-4 studio-scroll">
            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Template Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Clean teal two-column layout for consultancy roles"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Page Layout</label>
                <select
                  value={config.layout.structure}
                  onChange={(e) =>
                    setConfig({ ...config, layout: { ...config.layout, structure: e.target.value as any } })
                  }
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="one-column">One-Column</option>
                  <option value="two-column-balanced">Two-Column Split</option>
                  <option value="sidebar-left">Sidebar Left</option>
                  <option value="sidebar-right">Sidebar Right</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Header Layout</label>
                <select
                  value={config.layout.headerStyle}
                  onChange={(e) =>
                    setConfig({ ...config, layout: { ...config.layout, headerStyle: e.target.value as any } })
                  }
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="left-aligned">Left Aligned</option>
                  <option value="centered">Centered</option>
                  <option value="banner-colored">Colored Banner</option>
                  <option value="split-contact">Split Contact</option>
                  <option value="executive-rule">Executive Rule</option>
                  <option value="minimal">Minimal</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Section Headings</label>
                <select
                  value={config.layout.sectionHeadingStyle}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      layout: { ...config.layout, sectionHeadingStyle: e.target.value as any },
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="underline">Underline</option>
                  <option value="caps-rule">Caps + Rule</option>
                  <option value="left-bar">Left Accent Bar</option>
                  <option value="shaded-band">Shaded Band</option>
                  <option value="double-rule">Double Rule</option>
                  <option value="numbered">Numbered</option>
                  <option value="clean-bold">Clean Bold</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Decorative Element</label>
                <select
                  value={config.layout.decorativeAccent}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      layout: { ...config.layout, decorativeAccent: e.target.value as any },
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="none">None</option>
                  <option value="top-stripe">Top Accent Stripe</option>
                  <option value="corner-mark">Corner Frame</option>
                  <option value="sidebar-border">Sidebar Border</option>
                  <option value="footer-rule">Footer Rule</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Color Palette</label>
              <div className="grid grid-cols-3 gap-1.5">
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.presetName}
                    type="button"
                    onClick={() => setConfig({ ...config, colors: p })}
                    className={`p-1.5 rounded-lg border text-left text-[11px] font-medium flex items-center gap-1.5 ${
                      config.colors.primary === p.primary
                        ? 'border-[#142B4A] bg-[#EAF2FB]/60'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: p.primary }}
                    />
                    <span className="truncate">{p.presetName}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Body Font</label>
                <select
                  value={config.typography.fontFamily}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      typography: { ...config.typography, fontFamily: e.target.value as any },
                    })
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
                  value={config.typography.headingFontFamily}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      typography: { ...config.typography, headingFontFamily: e.target.value as any },
                    })
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
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Paper Format</label>
                <select
                  value={config.page.size}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      page: { ...config.page, size: e.target.value as 'A4' | 'LETTER' },
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="A4">A4</option>
                  <option value="LETTER">US Letter</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Header / Footer</label>
                <input
                  type="text"
                  value={config.layout.footerText}
                  onChange={(e) =>
                    setConfig({ ...config, layout: { ...config.layout, footerText: e.target.value } })
                  }
                  placeholder="Optional footer label"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="pt-3 flex gap-2">
              <button
                type="button"
                disabled={saving || !name.trim()}
                onClick={() => handleSave(false)}
                className="flex-1 py-2.5 px-3 text-xs font-semibold bg-[#EAF2FB] text-[#142B4A] hover:bg-[#dce9f9] rounded-lg"
              >
                Save to My Designs
              </button>
              <button
                type="button"
                disabled={saving || !name.trim()}
                onClick={() => handleSave(true)}
                className="flex-1 py-2.5 px-3 text-xs font-semibold bg-[#142B4A] text-white hover:bg-[#1e3d66] rounded-lg inline-flex items-center justify-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save & Create CV</span>
              </button>
            </div>
          </div>

          {/* Live Preview */}
          <div className="lg:col-span-7 bg-slate-100 p-6 overflow-auto flex justify-center studio-scroll">
            <CVRenderer cv={sampleCV} design={config} scale={0.68} />
          </div>
        </div>
      </div>
    </div>
  );
};
