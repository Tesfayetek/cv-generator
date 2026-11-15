import type { CVDocument, DesignConfiguration } from '../types/cv';

export interface ATSCheckItem {
  id: string;
  title: string;
  status: 'pass' | 'warning' | 'issue';
  detail: string;
}

export interface ATSReport {
  items: ATSCheckItem[];
  summaryNote: string;
}

const STANDARD_FONTS = new Set([
  'Arial',
  'Calibri',
  'Georgia',
  'Inter',
  'Lato',
  'Open Sans',
  'Roboto',
  'Source Sans 3',
  'Garamond',
  'Montserrat',
]);

export function analyzeATSReadiness(cv: CVDocument, design: DesignConfiguration): ATSReport {
  const items: ATSCheckItem[] = [];

  // 1. Reading order & column structure
  if (design.layout.structure === 'one-column' || cv.atsMode) {
    items.push({
      id: 'reading-order',
      title: 'Linear Single-Column Reading Order',
      status: 'pass',
      detail: 'Content flows top-to-bottom in a single column so applicant tracking parsers read sections in the intended sequence.',
    });
  } else {
    items.push({
      id: 'reading-order',
      title: 'Multi-Column Layout Detected',
      status: 'warning',
      detail: `Current layout uses "${design.layout.structure}". Older ATS parsers sometimes merge text across columns. Enable ATS Mode to force a clean linear layout on export.`,
    });
  }

  // 2. Photo & Decorative Graphics
  if (design.layout.showPhoto && !cv.atsMode) {
    items.push({
      id: 'graphics',
      title: 'Embedded Profile Photo Active',
      status: 'warning',
      detail: 'Unless applying in a region where photos are customary, hiding photos reduces parser distractions and visual bias.',
    });
  } else if (design.layout.skillDisplay === 'bars' && !cv.atsMode) {
    items.push({
      id: 'graphics',
      title: 'Visual Skill Progress Bars',
      status: 'warning',
      detail: 'Skill bars convey relative rating visually but do not carry numeric meaning to ATS parsers. Comma-separated or grouped text lists are clearer.',
    });
  } else {
    items.push({
      id: 'graphics',
      title: 'Clean Text-First Structure',
      status: 'pass',
      detail: 'No essential information is locked inside images, charts, or complex graphics.',
    });
  }

  // 3. Font Compatibility
  if (STANDARD_FONTS.has(design.typography.fontFamily)) {
    items.push({
      id: 'font',
      title: `Standard Readable Typography (${design.typography.fontFamily})`,
      status: 'pass',
      detail: 'Typography uses standard, universally parseable glyphs with clear hierarchy.',
    });
  } else {
    items.push({
      id: 'font',
      title: 'Custom Font Selection',
      status: 'warning',
      detail: 'Consider standard fonts like Calibri, Arial, Lato, or Georgia for predictable PDF/DOCX extraction.',
    });
  }

  // 4. Contact Information
  const p = cv.personalInformation;
  const hasContact = Boolean(p.fullName?.trim() && p.email?.trim() && p.phone?.trim());
  items.push({
    id: 'contact',
    title: 'Core Contact Details',
    status: hasContact ? 'pass' : 'issue',
    detail: hasContact
      ? 'Full name, email, and telephone are present in selectable body text (not trapped inside headers/images).'
      : 'Add your full name, email address, and telephone number so recruiters and parsers can identify you.',
  });

  // 5. Standard Section Headings & Core Sections
  const hasExp = cv.workExperience.length > 0;
  const hasEdu = cv.education.length > 0;
  const hasSkills = cv.skills.length > 0;
  items.push({
    id: 'sections',
    title: 'Standard CV Sections',
    status: hasExp && hasEdu && hasSkills ? 'pass' : 'warning',
    detail:
      hasExp && hasEdu && hasSkills
        ? 'Work Experience, Education, and Skills sections are populated with standard headings.'
        : 'Ensure Work Experience, Education, and Skills are populated for standard ATS indexing.',
  });

  // 6. Achievement Bullet Density
  const totalBullets = cv.workExperience.reduce((acc, w) => acc + (w.achievements?.length || 0), 0);
  items.push({
    id: 'bullets',
    title: 'Achievement Bullet Points',
    status: totalBullets >= 3 ? 'pass' : 'warning',
    detail:
      totalBullets >= 3
        ? `${totalBullets} achievement bullet points found across roles.`
        : 'Add concise action-oriented bullet points under your roles to highlight measurable outcomes and domain keywords.',
  });

  return {
    items,
    summaryNote:
      'ATS readiness checks evaluate structural clarity, selectable text, and standard conventions. No CV format can guarantee passing every employer ATS configuration.',
  };
}

export function resolveEffectiveDesign(
  templateDesign: DesignConfiguration,
  cv: CVDocument
): DesignConfiguration {
  const base = cv.designOverrides || templateDesign;
  if (!cv.atsMode) return base;

  return {
    ...base,
    layout: {
      ...base.layout,
      structure: 'one-column',
      showPhoto: false,
      skillDisplay: base.layout.skillDisplay === 'bars' ? 'grouped' : base.layout.skillDisplay,
      decorativeAccent: 'none',
      headerStyle: base.layout.headerStyle === 'banner-colored' ? 'left-aligned' : base.layout.headerStyle,
    },
  };
}
