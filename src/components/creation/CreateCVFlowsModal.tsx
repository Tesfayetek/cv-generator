import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FilePlus2,
  FileUp,
  Loader2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { createNewCVDocument, DEFAULT_SECTION_ORDER, DEFAULT_SECTION_TITLES } from '../../data/presets';
import type { CVDocument, CVTemplate } from '../../types/cv';

interface CreateCVFlowsModalProps {
  initialMethod: 'scratch' | 'upload' | 'ai';
  userId: string;
  templates: CVTemplate[];
  onClose: () => void;
  onCreateCV: (cv: CVDocument) => void;
}

export const CreateCVFlowsModal: React.FC<CreateCVFlowsModalProps> = ({
  initialMethod,
  userId,
  templates,
  onClose,
  onCreateCV,
}) => {
  const [method, setMethod] = useState<'scratch' | 'upload' | 'ai'>(initialMethod);
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    templates[0]?.templateId || 'tpl_classic_executive'
  );
  const [cvTitle, setCvTitle] = useState('');

  // Method 2: Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [extractedDraft, setExtractedDraft] = useState<any | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState('');

  // Method 3: AI Generation state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiDraft, setAiDraft] = useState<any | null>(null);
  const [aiForm, setAiForm] = useState({
    fullName: '',
    targetTitle: '',
    industry: '',
    yearsExperience: '',
    careerGoals: '',
    backgroundNotes: '',
    experienceNotes: '',
    educationNotes: '',
    skillsNotes: '',
  });

  const handleCreateFromScratch = (prefillSample: boolean) => {
    const title = cvTitle.trim() || (prefillSample ? 'Sample Executive CV' : 'Untitled Professional CV');
    const doc = createNewCVDocument(userId, selectedTemplateId, title, undefined, prefillSample);
    onCreateCV(doc);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setExtractedDraft(null);
    setUploadedFileName(file.name);
    setUploading(true);

    try {
      const reader = new FileReader();
      const base64Data: string = await new Promise((resolve, reject) => {
        reader.onload = () => {
          const result = String(reader.result || '');
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed reading file from disk.'));
        reader.readAsDataURL(file);
      });

      const resp = await fetch('/api/cv/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          base64Data,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Extraction failed.');
      setExtractedDraft(data.extracted);
      if (!cvTitle && data.extracted?.personalInformation?.fullName) {
        setCvTitle(`${data.extracted.personalInformation.fullName} — CV`);
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Could not extract CV sections from this file.');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmExtractedCV = () => {
    if (!extractedDraft) return;
    const base = createNewCVDocument(
      userId,
      selectedTemplateId,
      cvTitle.trim() || `${extractedDraft.personalInformation?.fullName || 'Imported'} CV`
    );

    const p = extractedDraft.personalInformation || {};
    const populated: CVDocument = {
      ...base,
      personalInformation: {
        fullName: p.fullName || '',
        professionalTitle: p.professionalTitle || '',
        email: p.email || '',
        phone: p.phone || '',
        location: p.location || '',
        linkedin: p.linkedin || '',
        website: p.website || '',
        photoUrl: '',
      },
      professionalSummary: extractedDraft.professionalSummary || '',
      careerObjective: extractedDraft.careerObjective || '',
      workExperience: (extractedDraft.workExperience || []).map((w: any, i: number) => ({
        id: `exp_${Date.now()}_${i}`,
        jobTitle: w.jobTitle || '',
        company: w.company || '',
        location: w.location || '',
        startDate: w.startDate || '',
        endDate: w.endDate || '',
        current: Boolean(w.current),
        description: w.description || '',
        achievements: Array.isArray(w.achievements) ? w.achievements : [],
      })),
      education: (extractedDraft.education || []).map((ed: any, i: number) => ({
        id: `edu_${Date.now()}_${i}`,
        degree: ed.degree || '',
        institution: ed.institution || '',
        location: ed.location || '',
        startDate: ed.startDate || '',
        endDate: ed.endDate || '',
        gpa: ed.gpa || '',
        honors: ed.honors || '',
      })),
      skills: (extractedDraft.skills || []).map((s: any, i: number) => ({
        id: `sk_${Date.now()}_${i}`,
        name: typeof s === 'string' ? s : s.name || '',
        category: s.category || 'Core',
        level: 4,
      })),
      certifications: (extractedDraft.certifications || []).map((c: any, i: number) => ({
        id: `cert_${Date.now()}_${i}`,
        name: c.name || '',
        issuer: c.issuer || '',
        date: c.date || '',
      })),
      languages: (extractedDraft.languages || []).map((l: any, i: number) => ({
        id: `lang_${Date.now()}_${i}`,
        name: l.name || '',
        proficiency: l.proficiency || 'Professional',
      })),
      projects: (extractedDraft.projects || []).map((pr: any, i: number) => ({
        id: `proj_${Date.now()}_${i}`,
        name: pr.name || '',
        role: pr.role || '',
        date: pr.date || '',
        description: pr.description || '',
        highlights: Array.isArray(pr.highlights) ? pr.highlights : [],
      })),
      awards: (extractedDraft.awards || []).map((aw: any, i: number) => ({
        id: `aw_${Date.now()}_${i}`,
        title: aw.title || '',
        issuer: aw.issuer || '',
        date: aw.date || '',
        description: aw.description || '',
      })),
      publications: (extractedDraft.publications || []).map((pb: any, i: number) => ({
        id: `pub_${Date.now()}_${i}`,
        title: pb.title || '',
        venue: pb.venue || '',
        year: pb.year || '',
        authors: pb.authors || '',
      })),
      volunteerExperience: (extractedDraft.volunteerExperience || []).map((v: any, i: number) => ({
        id: `vol_${Date.now()}_${i}`,
        role: v.role || '',
        organization: v.organization || '',
        startDate: v.startDate || '',
        endDate: v.endDate || '',
        description: v.description || '',
      })),
      references: (extractedDraft.references || []).map((r: any, i: number) => ({
        id: `ref_${Date.now()}_${i}`,
        name: r.name || '',
        title: r.title || '',
        organization: r.organization || '',
        email: r.email || '',
        phone: r.phone || '',
        relationship: r.relationship || '',
      })),
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      sectionTitles: { ...DEFAULT_SECTION_TITLES },
    };

    onCreateCV(populated);
  };

  const handleGenerateAICV = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiError('');
    setAiDraft(null);
    setAiLoading(true);
    try {
      const resp = await fetch('/api/ai/generate-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiForm),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'AI CV generation failed.');
      setAiDraft(data);
    } catch (err: any) {
      setAiError(err?.message || 'Failed to generate CV draft.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleConfirmAICV = () => {
    if (!aiDraft) return;
    const base = createNewCVDocument(
      userId,
      selectedTemplateId,
      cvTitle.trim() || `${aiForm.fullName || aiForm.targetTitle || 'AI'} CV`
    );
    const populated: CVDocument = {
      ...base,
      personalInformation: {
        ...base.personalInformation,
        fullName: aiForm.fullName.trim(),
        professionalTitle: aiDraft.professionalTitle || aiForm.targetTitle,
      },
      professionalSummary: aiDraft.professionalSummary || '',
      careerObjective: aiDraft.careerObjective || '',
      workExperience: (aiDraft.workExperience || []).map((w: any, i: number) => ({
        id: `exp_${Date.now()}_${i}`,
        jobTitle: w.jobTitle || '',
        company: w.company || '',
        location: w.location || '',
        startDate: w.startDate || '',
        endDate: w.endDate || '',
        current: false,
        description: w.description || '',
        achievements: Array.isArray(w.achievements) ? w.achievements : [],
      })),
      education: (aiDraft.education || []).map((ed: any, i: number) => ({
        id: `edu_${Date.now()}_${i}`,
        degree: ed.degree || '',
        institution: ed.institution || '',
        location: ed.location || '',
        startDate: ed.startDate || '',
        endDate: ed.endDate || '',
        honors: ed.honors || '',
      })),
      skills: (aiDraft.skills || []).map((s: any, i: number) => ({
        id: `sk_${Date.now()}_${i}`,
        name: s.name || '',
        category: s.category || 'Core',
        level: 4,
      })),
      certifications: (aiDraft.certifications || []).map((c: any, i: number) => ({
        id: `cert_${Date.now()}_${i}`,
        name: c.name || '',
        issuer: c.issuer || '',
        date: c.date || '',
      })),
      languages: (aiDraft.languages || []).map((l: any, i: number) => ({
        id: `lang_${Date.now()}_${i}`,
        name: l.name || '',
        proficiency: l.proficiency || 'Professional',
      })),
    };
    onCreateCV(populated);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#142B4A]">Create New CV Document</h2>
            <p className="text-xs text-slate-500">
              Choose how you would like to start — you can change templates and edit everything in the Studio.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Method Switcher */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setMethod('scratch')}
              className={`py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                method === 'scratch' ? 'bg-white text-[#142B4A] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>From Scratch</span>
            </button>
            <button
              type="button"
              onClick={() => setMethod('upload')}
              className={`py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                method === 'upload' ? 'bg-white text-[#142B4A] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>Upload Existing CV</span>
            </button>
            <button
              type="button"
              onClick={() => setMethod('ai')}
              className={`py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                method === 'ai' ? 'bg-white text-[#142B4A] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI CV Generator</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 studio-scroll">
          {/* Common Title & Initial Template */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                CV Document Name
              </label>
              <input
                type="text"
                value={cvTitle}
                onChange={(e) => setCvTitle(e.target.value)}
                placeholder="e.g., Senior Programme Manager — 2026"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#2864A6]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Starting Design Template
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#2864A6]"
              >
                {templates.map((t) => (
                  <option key={t.templateId} value={t.templateId}>
                    {t.name} ({t.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* METHOD 1: SCRATCH */}
          {method === 'scratch' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                Start with a clean structured editor covering Personal Information, Summary, Experience, Education, Skills, Certifications, Languages, Projects, Awards, Publications, Volunteer Work, and References.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleCreateFromScratch(false)}
                  className="px-4 py-2.5 text-sm font-semibold bg-[#142B4A] hover:bg-[#1e3d66] text-white rounded-lg transition-colors"
                >
                  Open Blank CV in Studio
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateFromScratch(true)}
                  className="px-4 py-2.5 text-sm font-semibold bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg transition-colors"
                >
                  Start with Editable Sample Content
                </button>
              </div>
            </div>
          )}

          {/* METHOD 2: UPLOAD EXISTING CV */}
          {method === 'upload' && (
            <div className="space-y-4">
              <label className="block border-2 border-dashed border-slate-300 hover:border-[#2864A6] rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-50">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileSelected}
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-[#2864A6] mx-auto mb-2" />
                <div className="text-sm font-semibold text-[#142B4A]">
                  {uploading
                    ? 'Extracting structured CV sections...'
                    : uploadedFileName
                    ? `Selected: ${uploadedFileName} (click to replace)`
                    : 'Upload DOCX or PDF CV Document'}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Preserves exact dates, employers, degrees, and achievements. Review extracted fields before saving.
                </p>
              </label>

              {uploading && (
                <div className="flex items-center justify-center gap-2 text-sm text-[#2864A6] py-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Parsing document structure and extracting sections...</span>
                </div>
              )}

              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {extractedDraft && (
                <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Review Extracted CV Data</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      Verify accuracy before opening Studio
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 bg-white p-3 rounded-lg border border-slate-200 text-xs">
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">Full Name</label>
                      <input
                        type="text"
                        value={extractedDraft.personalInformation?.fullName || ''}
                        onChange={(e) =>
                          setExtractedDraft({
                            ...extractedDraft,
                            personalInformation: {
                              ...extractedDraft.personalInformation,
                              fullName: e.target.value,
                            },
                          })
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">Professional Title</label>
                      <input
                        type="text"
                        value={extractedDraft.personalInformation?.professionalTitle || ''}
                        onChange={(e) =>
                          setExtractedDraft({
                            ...extractedDraft,
                            personalInformation: {
                              ...extractedDraft.personalInformation,
                              professionalTitle: e.target.value,
                            },
                          })
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded"
                      />
                    </div>
                    <div className="sm:col-span-2 text-slate-600 pt-1">
                      Extracted:{' '}
                      <strong>{extractedDraft.workExperience?.length || 0}</strong> work roles ·{' '}
                      <strong>{extractedDraft.education?.length || 0}</strong> education entries ·{' '}
                      <strong>{extractedDraft.skills?.length || 0}</strong> skills ·{' '}
                      <strong>{extractedDraft.certifications?.length || 0}</strong> certifications
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmExtractedCV}
                    className="w-full py-2.5 bg-[#142B4A] hover:bg-[#1e3d66] text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Create CV with Extracted Data & Open Studio
                  </button>
                </div>
              )}
            </div>
          )}

          {/* METHOD 3: AI-ASSISTED CV GENERATION */}
          {method === 'ai' && (
            <form onSubmit={handleGenerateAICV} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Your Full Name</label>
                  <input
                    type="text"
                    value={aiForm.fullName}
                    onChange={(e) => setAiForm({ ...aiForm, fullName: e.target.value })}
                    placeholder="e.g., Nadia Mensah"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Job Title *</label>
                  <input
                    type="text"
                    required
                    value={aiForm.targetTitle}
                    onChange={(e) => setAiForm({ ...aiForm, targetTitle: e.target.value })}
                    placeholder="e.g., Monitoring & Evaluation Specialist"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Industry / Sector</label>
                  <input
                    type="text"
                    value={aiForm.industry}
                    onChange={(e) => setAiForm({ ...aiForm, industry: e.target.value })}
                    placeholder="e.g., International Development / SaaS / Healthcare"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Years of Experience</label>
                  <input
                    type="text"
                    value={aiForm.yearsExperience}
                    onChange={(e) => setAiForm({ ...aiForm, yearsExperience: e.target.value })}
                    placeholder="e.g., 7 years"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Professional Background & Work Experience Notes *
                </label>
                <textarea
                  rows={4}
                  required
                  value={aiForm.experienceNotes}
                  onChange={(e) => setAiForm({ ...aiForm, experienceNotes: e.target.value })}
                  placeholder="Describe your actual employers, roles, dates, and accomplishments (AI will structure and polish without inventing facts)..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Education & Certifications</label>
                  <textarea
                    rows={2}
                    value={aiForm.educationNotes}
                    onChange={(e) => setAiForm({ ...aiForm, educationNotes: e.target.value })}
                    placeholder="Degrees, institutions, years..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Skills & Career Goals</label>
                  <textarea
                    rows={2}
                    value={aiForm.skillsNotes}
                    onChange={(e) => setAiForm({ ...aiForm, skillsNotes: e.target.value })}
                    placeholder="Core technical/soft skills, languages, target goal..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {aiError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {aiError}
                </div>
              )}

              <button
                type="submit"
                disabled={aiLoading}
                className="px-5 py-2.5 bg-[#2864A6] hover:bg-[#1f528b] disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-2"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{aiLoading ? 'Generating Structured CV Draft...' : 'Generate Structured CV Draft'}</span>
              </button>

              {aiDraft && (
                <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 space-y-3">
                  <div className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Review AI-Generated Draft</span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-2">
                    <div>
                      <span className="font-semibold text-slate-600">Summary Preview:</span>
                      <p className="mt-1 text-slate-800 leading-relaxed">{aiDraft.professionalSummary}</p>
                    </div>
                    <div className="text-slate-600">
                      Generated: <strong>{aiDraft.workExperience?.length || 0}</strong> roles ·{' '}
                      <strong>{aiDraft.education?.length || 0}</strong> education entries ·{' '}
                      <strong>{aiDraft.skills?.length || 0}</strong> skills
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirmAICV}
                    className="w-full py-2.5 bg-[#142B4A] hover:bg-[#1e3d66] text-white text-sm font-semibold rounded-lg"
                  >
                    Accept Draft & Edit in Studio
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
