import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import { SAMPLE_PORTRAIT_URL } from '../../data/presets';
import type { CVDocument } from '../../types/cv';

interface CVContentEditorProps {
  cv: CVDocument;
  onChange: (updater: (prev: CVDocument) => CVDocument) => void;
  onRequestAIForSection: (section: string, text: string, targetExpId?: string) => void;
}

export const CVContentEditor: React.FC<CVContentEditorProps> = ({
  cv,
  onChange,
  onRequestAIForSection,
}) => {
  const [openGroup, setOpenGroup] = useState<string>('personal');

  const toggle = (key: string) => setOpenGroup((prev) => (prev === key ? '' : key));

  const updatePersonal = (field: string, value: string) => {
    onChange((prev) => ({
      ...prev,
      personalInformation: { ...prev.personalInformation, [field]: value },
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updatePersonal('photoUrl', String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const SectionAccordion: React.FC<{
    id: string;
    title: string;
    count?: number;
    children: React.ReactNode;
  }> = ({ id, title, count, children }) => {
    const isOpen = openGroup === id;
    return (
      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => toggle(id)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
        >
          <span className="text-xs font-bold text-[#142B4A] tracking-wide">
            {title}
            {typeof count === 'number' && (
              <span className="ml-1.5 text-slate-400 font-medium tabular-nums">({count})</span>
            )}
          </span>
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </button>
        {isOpen && <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3">{children}</div>}
      </div>
    );
  };

  return (
    <div className="space-y-2.5">
      {/* Personal Information */}
      <SectionAccordion id="personal" title="Personal Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Full Name</label>
            <input
              type="text"
              value={cv.personalInformation.fullName}
              onChange={(e) => updatePersonal('fullName', e.target.value)}
              placeholder="e.g., Marcus Vance"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Professional Title</label>
            <input
              type="text"
              value={cv.personalInformation.professionalTitle}
              onChange={(e) => updatePersonal('professionalTitle', e.target.value)}
              placeholder="e.g., Director of Operations"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Email</label>
            <input
              type="email"
              value={cv.personalInformation.email}
              onChange={(e) => updatePersonal('email', e.target.value)}
              placeholder="you@example.com"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Telephone</label>
            <input
              type="text"
              value={cv.personalInformation.phone}
              onChange={(e) => updatePersonal('phone', e.target.value)}
              placeholder="+44 20 7946 0821"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Location</label>
            <input
              type="text"
              value={cv.personalInformation.location}
              onChange={(e) => updatePersonal('location', e.target.value)}
              placeholder="London, UK"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">LinkedIn</label>
            <input
              type="text"
              value={cv.personalInformation.linkedin}
              onChange={(e) => updatePersonal('linkedin', e.target.value)}
              placeholder="linkedin.com/in/username"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Personal Website / Portfolio</label>
            <input
              type="text"
              value={cv.personalInformation.website}
              onChange={(e) => updatePersonal('website', e.target.value)}
              placeholder="yourportfolio.com"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img
              src={cv.personalInformation.photoUrl || SAMPLE_PORTRAIT_URL}
              alt="CV portrait preview"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg object-cover border border-slate-200"
            />
            <label className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer inline-flex items-center gap-1">
              <Upload className="w-3 h-3" />
              <span>Upload Photo</span>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>
          </div>
          {cv.personalInformation.photoUrl && (
            <button
              type="button"
              onClick={() => updatePersonal('photoUrl', '')}
              className="text-[11px] text-rose-600 hover:underline font-medium"
            >
              Reset Photo
            </button>
          )}
        </div>
      </SectionAccordion>

      {/* Professional Summary */}
      <SectionAccordion id="summary" title="Professional Summary">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onRequestAIForSection('summary', cv.professionalSummary)}
            className="text-[11px] font-semibold text-[#2864A6] hover:text-[#142B4A] inline-flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            <span>AI Improve / Generate Summary</span>
          </button>
        </div>
        <textarea
          rows={4}
          value={cv.professionalSummary}
          onChange={(e) => onChange((prev) => ({ ...prev, professionalSummary: e.target.value }))}
          placeholder="Summarize your core expertise, leadership scope, and impact..."
          className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg leading-relaxed"
        />
      </SectionAccordion>

      {/* Career Objective */}
      <SectionAccordion id="objective" title="Career Objective">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onRequestAIForSection('objective', cv.careerObjective)}
            className="text-[11px] font-semibold text-[#2864A6] hover:text-[#142B4A] inline-flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            <span>AI Generate Objective</span>
          </button>
        </div>
        <textarea
          rows={3}
          value={cv.careerObjective}
          onChange={(e) => onChange((prev) => ({ ...prev, careerObjective: e.target.value }))}
          placeholder="Optional career objective (especially helpful for graduates or career pivots)..."
          className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg leading-relaxed"
        />
      </SectionAccordion>

      {/* Work Experience */}
      <SectionAccordion id="experience" title="Work Experience" count={cv.workExperience.length}>
        <div className="space-y-3">
          {cv.workExperience.map((exp, idx) => (
            <div key={exp.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-[#142B4A]">Role #{idx + 1}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onRequestAIForSection(
                        'experience',
                        `${exp.jobTitle} at ${exp.company}\n${exp.description}\n${exp.achievements.join('\n')}`,
                        exp.id
                      )
                    }
                    className="text-[11px] font-semibold text-[#2864A6] hover:underline inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>AI Polish</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChange((prev) => ({
                        ...prev,
                        workExperience: prev.workExperience.filter((item) => item.id !== exp.id),
                      }))
                    }
                    className="text-slate-400 hover:text-rose-600"
                    aria-label="Remove role"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={exp.jobTitle}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      workExperience: prev.workExperience.map((w) =>
                        w.id === exp.id ? { ...w, jobTitle: e.target.value } : w
                      ),
                    }))
                  }
                  placeholder="Job Title"
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
                <input
                  type="text"
                  value={exp.company}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      workExperience: prev.workExperience.map((w) =>
                        w.id === exp.id ? { ...w, company: e.target.value } : w
                      ),
                    }))
                  }
                  placeholder="Employer / Organization"
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
                <input
                  type="text"
                  value={exp.location}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      workExperience: prev.workExperience.map((w) =>
                        w.id === exp.id ? { ...w, location: e.target.value } : w
                      ),
                    }))
                  }
                  placeholder="Location"
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={exp.startDate}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        workExperience: prev.workExperience.map((w) =>
                          w.id === exp.id ? { ...w, startDate: e.target.value } : w
                        ),
                      }))
                    }
                    placeholder="Start"
                    className="w-1/2 px-2 py-1.5 text-xs bg-white border border-slate-300 rounded"
                  />
                  <input
                    type="text"
                    disabled={exp.current}
                    value={exp.current ? 'Present' : exp.endDate}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        workExperience: prev.workExperience.map((w) =>
                          w.id === exp.id ? { ...w, endDate: e.target.value } : w
                        ),
                      }))
                    }
                    placeholder="End"
                    className="w-1/2 px-2 py-1.5 text-xs bg-white border border-slate-300 rounded disabled:bg-slate-100"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={exp.current}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      workExperience: prev.workExperience.map((w) =>
                        w.id === exp.id ? { ...w, current: e.target.checked } : w
                      ),
                    }))
                  }
                />
                <span>Currently working here</span>
              </label>

              <textarea
                rows={2}
                value={exp.description}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    workExperience: prev.workExperience.map((w) =>
                      w.id === exp.id ? { ...w, description: e.target.value } : w
                    ),
                  }))
                }
                placeholder="Role overview..."
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
              />

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Key Achievements (one bullet per line)
                </label>
                <textarea
                  rows={3}
                  value={(exp.achievements || []).join('\n')}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      workExperience: prev.workExperience.map((w) =>
                        w.id === exp.id ? { ...w, achievements: e.target.value.split('\n') } : w
                      ),
                    }))
                  }
                  placeholder="Reduced operational costs by 18%..."
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded leading-relaxed"
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              onChange((prev) => ({
                ...prev,
                workExperience: [
                  ...prev.workExperience,
                  {
                    id: `exp_${Date.now()}`,
                    jobTitle: '',
                    company: '',
                    location: '',
                    startDate: '',
                    endDate: '',
                    current: false,
                    description: '',
                    achievements: [''],
                  },
                ],
              }))
            }
            className="w-full py-2 text-xs font-semibold text-[#142B4A] bg-[#EAF2FB] hover:bg-[#dce9f9] rounded-lg flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Work Experience</span>
          </button>
        </div>
      </SectionAccordion>

      {/* Education */}
      <SectionAccordion id="education" title="Education" count={cv.education.length}>
        <div className="space-y-2.5">
          {cv.education.map((edu) => (
            <div key={edu.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      education: prev.education.filter((e) => e.id !== edu.id),
                    }))
                  }
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={edu.degree}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      education: prev.education.map((item) =>
                        item.id === edu.id ? { ...item, degree: e.target.value } : item
                      ),
                    }))
                  }
                  placeholder="Degree / Qualification"
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
                <input
                  type="text"
                  value={edu.institution}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      education: prev.education.map((item) =>
                        item.id === edu.id ? { ...item, institution: e.target.value } : item
                      ),
                    }))
                  }
                  placeholder="University / Institution"
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
                <input
                  type="text"
                  value={edu.startDate}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      education: prev.education.map((item) =>
                        item.id === edu.id ? { ...item, startDate: e.target.value } : item
                      ),
                    }))
                  }
                  placeholder="Start Year"
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
                <input
                  type="text"
                  value={edu.endDate}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      education: prev.education.map((item) =>
                        item.id === edu.id ? { ...item, endDate: e.target.value } : item
                      ),
                    }))
                  }
                  placeholder="End Year"
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
                <input
                  type="text"
                  value={edu.honors || ''}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      education: prev.education.map((item) =>
                        item.id === edu.id ? { ...item, honors: e.target.value } : item
                      ),
                    }))
                  }
                  placeholder="Honors / Distinction"
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
                <input
                  type="text"
                  value={edu.gpa || ''}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      education: prev.education.map((item) =>
                        item.id === edu.id ? { ...item, gpa: e.target.value } : item
                      ),
                    }))
                  }
                  placeholder="GPA (optional)"
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange((prev) => ({
                ...prev,
                education: [
                  ...prev.education,
                  { id: `edu_${Date.now()}`, degree: '', institution: '', location: '', startDate: '', endDate: '' },
                ],
              }))
            }
            className="w-full py-2 text-xs font-semibold text-[#142B4A] bg-[#EAF2FB] hover:bg-[#dce9f9] rounded-lg flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Education</span>
          </button>
        </div>
      </SectionAccordion>

      {/* Skills */}
      <SectionAccordion id="skills" title="Skills" count={cv.skills.length}>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() =>
              onRequestAIForSection('skills', cv.skills.map((s) => s.name).join(', '))
            }
            className="text-[11px] font-semibold text-[#2864A6] hover:text-[#142B4A] inline-flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            <span>AI Identify & Organize Skills</span>
          </button>
        </div>
        <div className="space-y-2">
          {cv.skills.map((sk) => (
            <div key={sk.id} className="grid grid-cols-12 gap-1.5 items-center">
              <input
                type="text"
                value={sk.name}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    skills: prev.skills.map((s) => (s.id === sk.id ? { ...s, name: e.target.value } : s)),
                  }))
                }
                placeholder="Skill"
                className="col-span-6 px-2.5 py-1.5 text-xs border border-slate-300 rounded"
              />
              <input
                type="text"
                value={sk.category}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    skills: prev.skills.map((s) => (s.id === sk.id ? { ...s, category: e.target.value } : s)),
                  }))
                }
                placeholder="Category"
                className="col-span-3 px-2 py-1.5 text-xs border border-slate-300 rounded"
              />
              <select
                value={sk.level}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    skills: prev.skills.map((s) =>
                      s.id === sk.id ? { ...s, level: Number(e.target.value) } : s
                    ),
                  }))
                }
                className="col-span-2 px-1 py-1.5 text-xs border border-slate-300 rounded bg-white"
              >
                {[1, 2, 3, 4, 5].map((lv) => (
                  <option key={lv} value={lv}>
                    {lv}/5
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    skills: prev.skills.filter((s) => s.id !== sk.id),
                  }))
                }
                className="col-span-1 text-slate-400 hover:text-rose-600 flex justify-center"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange((prev) => ({
                ...prev,
                skills: [...prev.skills, { id: `sk_${Date.now()}`, name: '', category: 'Core', level: 4 }],
              }))
            }
            className="w-full py-2 text-xs font-semibold text-[#142B4A] bg-[#EAF2FB] hover:bg-[#dce9f9] rounded-lg flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Skill</span>
          </button>
        </div>
      </SectionAccordion>

      {/* Certifications */}
      <SectionAccordion id="certifications" title="Certifications" count={cv.certifications.length}>
        <div className="space-y-2">
          {cv.certifications.map((cert) => (
            <div key={cert.id} className="grid grid-cols-12 gap-1.5 items-center">
              <input
                type="text"
                value={cert.name}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    certifications: prev.certifications.map((c) =>
                      c.id === cert.id ? { ...c, name: e.target.value } : c
                    ),
                  }))
                }
                placeholder="Certification Name"
                className="col-span-5 px-2 py-1.5 text-xs border border-slate-300 rounded"
              />
              <input
                type="text"
                value={cert.issuer}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    certifications: prev.certifications.map((c) =>
                      c.id === cert.id ? { ...c, issuer: e.target.value } : c
                    ),
                  }))
                }
                placeholder="Issuer"
                className="col-span-4 px-2 py-1.5 text-xs border border-slate-300 rounded"
              />
              <input
                type="text"
                value={cert.date}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    certifications: prev.certifications.map((c) =>
                      c.id === cert.id ? { ...c, date: e.target.value } : c
                    ),
                  }))
                }
                placeholder="Year"
                className="col-span-2 px-2 py-1.5 text-xs border border-slate-300 rounded"
              />
              <button
                type="button"
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    certifications: prev.certifications.filter((c) => c.id !== cert.id),
                  }))
                }
                className="col-span-1 text-slate-400 hover:text-rose-600 flex justify-center"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange((prev) => ({
                ...prev,
                certifications: [...prev.certifications, { id: `cert_${Date.now()}`, name: '', issuer: '', date: '' }],
              }))
            }
            className="w-full py-2 text-xs font-semibold text-[#142B4A] bg-[#EAF2FB] hover:bg-[#dce9f9] rounded-lg flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Certification</span>
          </button>
        </div>
      </SectionAccordion>

      {/* Languages */}
      <SectionAccordion id="languages" title="Languages" count={cv.languages.length}>
        <div className="space-y-2">
          {cv.languages.map((lang) => (
            <div key={lang.id} className="grid grid-cols-12 gap-1.5 items-center">
              <input
                type="text"
                value={lang.name}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    languages: prev.languages.map((l) => (l.id === lang.id ? { ...l, name: e.target.value } : l)),
                  }))
                }
                placeholder="Language"
                className="col-span-6 px-2.5 py-1.5 text-xs border border-slate-300 rounded"
              />
              <select
                value={lang.proficiency}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    languages: prev.languages.map((l) =>
                      l.id === lang.id ? { ...l, proficiency: e.target.value as any } : l
                    ),
                  }))
                }
                className="col-span-5 px-2 py-1.5 text-xs border border-slate-300 rounded bg-white"
              >
                {['Native', 'Fluent', 'Professional', 'Intermediate', 'Basic'].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    languages: prev.languages.filter((l) => l.id !== lang.id),
                  }))
                }
                className="col-span-1 text-slate-400 hover:text-rose-600 flex justify-center"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange((prev) => ({
                ...prev,
                languages: [...prev.languages, { id: `lang_${Date.now()}`, name: '', proficiency: 'Professional' }],
              }))
            }
            className="w-full py-2 text-xs font-semibold text-[#142B4A] bg-[#EAF2FB] hover:bg-[#dce9f9] rounded-lg flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Language</span>
          </button>
        </div>
      </SectionAccordion>

      {/* Projects */}
      <SectionAccordion id="projects" title="Projects" count={cv.projects.length}>
        <div className="space-y-2.5">
          {cv.projects.map((proj) => (
            <div key={proj.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      projects: prev.projects.filter((p) => p.id !== proj.id),
                    }))
                  }
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={proj.name}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      projects: prev.projects.map((p) => (p.id === proj.id ? { ...p, name: e.target.value } : p)),
                    }))
                  }
                  placeholder="Project Name"
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
                <input
                  type="text"
                  value={proj.role}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      projects: prev.projects.map((p) => (p.id === proj.id ? { ...p, role: e.target.value } : p)),
                    }))
                  }
                  placeholder="Role"
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
              </div>
              <textarea
                rows={2}
                value={proj.description}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    projects: prev.projects.map((p) =>
                      p.id === proj.id ? { ...p, description: e.target.value } : p
                    ),
                  }))
                }
                placeholder="Project description & outcomes..."
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange((prev) => ({
                ...prev,
                projects: [
                  ...prev.projects,
                  { id: `proj_${Date.now()}`, name: '', role: '', date: '', description: '', highlights: [] },
                ],
              }))
            }
            className="w-full py-2 text-xs font-semibold text-[#142B4A] bg-[#EAF2FB] hover:bg-[#dce9f9] rounded-lg flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Project</span>
          </button>
        </div>
      </SectionAccordion>

      {/* Awards, Publications, Volunteer, References */}
      <SectionAccordion id="awards" title="Awards & Honors" count={cv.awards.length}>
        <div className="space-y-2">
          {cv.awards.map((aw) => (
            <div key={aw.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={aw.title}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      awards: prev.awards.map((a) => (a.id === aw.id ? { ...a, title: e.target.value } : a)),
                    }))
                  }
                  placeholder="Award Title"
                  className="flex-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({ ...prev, awards: prev.awards.filter((a) => a.id !== aw.id) }))
                  }
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  value={aw.issuer}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      awards: prev.awards.map((a) => (a.id === aw.id ? { ...a, issuer: e.target.value } : a)),
                    }))
                  }
                  placeholder="Issuer"
                  className="px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                />
                <input
                  type="text"
                  value={aw.date}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      awards: prev.awards.map((a) => (a.id === aw.id ? { ...a, date: e.target.value } : a)),
                    }))
                  }
                  placeholder="Year"
                  className="px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange((prev) => ({
                ...prev,
                awards: [...prev.awards, { id: `aw_${Date.now()}`, title: '', issuer: '', date: '', description: '' }],
              }))
            }
            className="w-full py-2 text-xs font-semibold text-[#142B4A] bg-[#EAF2FB] hover:bg-[#dce9f9] rounded-lg flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Award</span>
          </button>
        </div>
      </SectionAccordion>

      <SectionAccordion id="publications" title="Publications" count={cv.publications.length}>
        <div className="space-y-2">
          {cv.publications.map((pub) => (
            <div key={pub.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={pub.title}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      publications: prev.publications.map((p) =>
                        p.id === pub.id ? { ...p, title: e.target.value } : p
                      ),
                    }))
                  }
                  placeholder="Publication Title"
                  className="flex-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      publications: prev.publications.filter((p) => p.id !== pub.id),
                    }))
                  }
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <input
                  type="text"
                  value={pub.authors}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      publications: prev.publications.map((p) =>
                        p.id === pub.id ? { ...p, authors: e.target.value } : p
                      ),
                    }))
                  }
                  placeholder="Authors"
                  className="px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                />
                <input
                  type="text"
                  value={pub.venue}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      publications: prev.publications.map((p) =>
                        p.id === pub.id ? { ...p, venue: e.target.value } : p
                      ),
                    }))
                  }
                  placeholder="Journal / Venue"
                  className="px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                />
                <input
                  type="text"
                  value={pub.year}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      publications: prev.publications.map((p) =>
                        p.id === pub.id ? { ...p, year: e.target.value } : p
                      ),
                    }))
                  }
                  placeholder="Year"
                  className="px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange((prev) => ({
                ...prev,
                publications: [
                  ...prev.publications,
                  { id: `pub_${Date.now()}`, title: '', venue: '', year: '', authors: '' },
                ],
              }))
            }
            className="w-full py-2 text-xs font-semibold text-[#142B4A] bg-[#EAF2FB] hover:bg-[#dce9f9] rounded-lg flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Publication</span>
          </button>
        </div>
      </SectionAccordion>

      <SectionAccordion id="volunteer" title="Volunteer Experience" count={cv.volunteerExperience.length}>
        <div className="space-y-2">
          {cv.volunteerExperience.map((vol) => (
            <div key={vol.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
              <div className="flex justify-between gap-2">
                <input
                  type="text"
                  value={vol.role}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      volunteerExperience: prev.volunteerExperience.map((v) =>
                        v.id === vol.id ? { ...v, role: e.target.value } : v
                      ),
                    }))
                  }
                  placeholder="Role"
                  className="flex-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      volunteerExperience: prev.volunteerExperience.filter((v) => v.id !== vol.id),
                    }))
                  }
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <input
                  type="text"
                  value={vol.organization}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      volunteerExperience: prev.volunteerExperience.map((v) =>
                        v.id === vol.id ? { ...v, organization: e.target.value } : v
                      ),
                    }))
                  }
                  placeholder="Organization"
                  className="px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                />
                <input
                  type="text"
                  value={vol.startDate}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      volunteerExperience: prev.volunteerExperience.map((v) =>
                        v.id === vol.id ? { ...v, startDate: e.target.value } : v
                      ),
                    }))
                  }
                  placeholder="Start"
                  className="px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                />
                <input
                  type="text"
                  value={vol.endDate}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      volunteerExperience: prev.volunteerExperience.map((v) =>
                        v.id === vol.id ? { ...v, endDate: e.target.value } : v
                      ),
                    }))
                  }
                  placeholder="End"
                  className="px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                />
              </div>
              <textarea
                rows={2}
                value={vol.description}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    volunteerExperience: prev.volunteerExperience.map((v) =>
                      v.id === vol.id ? { ...v, description: e.target.value } : v
                    ),
                  }))
                }
                placeholder="Description..."
                className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange((prev) => ({
                ...prev,
                volunteerExperience: [
                  ...prev.volunteerExperience,
                  { id: `vol_${Date.now()}`, role: '', organization: '', startDate: '', endDate: '', description: '' },
                ],
              }))
            }
            className="w-full py-2 text-xs font-semibold text-[#142B4A] bg-[#EAF2FB] hover:bg-[#dce9f9] rounded-lg flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Volunteer Role</span>
          </button>
        </div>
      </SectionAccordion>

      <SectionAccordion id="references" title="References" count={cv.references.length}>
        <div className="space-y-2">
          {cv.references.map((ref) => (
            <div key={ref.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
              <div className="flex justify-between gap-2">
                <input
                  type="text"
                  value={ref.name}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      references: prev.references.map((r) => (r.id === ref.id ? { ...r, name: e.target.value } : r)),
                    }))
                  }
                  placeholder="Full Name"
                  className="flex-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      references: prev.references.filter((r) => r.id !== ref.id),
                    }))
                  }
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  value={ref.title}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      references: prev.references.map((r) => (r.id === ref.id ? { ...r, title: e.target.value } : r)),
                    }))
                  }
                  placeholder="Title"
                  className="px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                />
                <input
                  type="text"
                  value={ref.organization}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      references: prev.references.map((r) =>
                        r.id === ref.id ? { ...r, organization: e.target.value } : r
                      ),
                    }))
                  }
                  placeholder="Organization"
                  className="px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                />
                <input
                  type="text"
                  value={ref.email}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      references: prev.references.map((r) => (r.id === ref.id ? { ...r, email: e.target.value } : r)),
                    }))
                  }
                  placeholder="Email"
                  className="px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                />
                <input
                  type="text"
                  value={ref.phone}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      references: prev.references.map((r) => (r.id === ref.id ? { ...r, phone: e.target.value } : r)),
                    }))
                  }
                  placeholder="Phone"
                  className="px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange((prev) => ({
                ...prev,
                references: [
                  ...prev.references,
                  { id: `ref_${Date.now()}`, name: '', title: '', organization: '', email: '', phone: '', relationship: '' },
                ],
              }))
            }
            className="w-full py-2 text-xs font-semibold text-[#142B4A] bg-[#EAF2FB] hover:bg-[#dce9f9] rounded-lg flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Reference</span>
          </button>
        </div>
      </SectionAccordion>
    </div>
  );
};
