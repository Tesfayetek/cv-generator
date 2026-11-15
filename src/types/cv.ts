export type CVFontFamily =
  | 'Inter'
  | 'Arial'
  | 'Calibri'
  | 'Roboto'
  | 'Lato'
  | 'Open Sans'
  | 'Georgia'
  | 'Garamond'
  | 'Montserrat'
  | 'Source Sans 3';

export type LayoutStructure =
  | 'one-column'
  | 'two-column-balanced'
  | 'sidebar-left'
  | 'sidebar-right';

export type HeaderStyle =
  | 'centered'
  | 'left-aligned'
  | 'banner-colored'
  | 'minimal'
  | 'split-contact'
  | 'executive-rule';

export type SectionHeadingStyle =
  | 'underline'
  | 'caps-rule'
  | 'left-bar'
  | 'shaded-band'
  | 'clean-bold'
  | 'numbered'
  | 'double-rule';

export type SkillDisplayStyle = 'tags' | 'bars' | 'grid' | 'comma' | 'grouped';
export type BulletStyle = 'disc' | 'square' | 'dash' | 'arrow' | 'none';
export type TimelineStyle = 'none' | 'dots' | 'dates-left';
export type DecorativeAccent = 'none' | 'top-stripe' | 'corner-mark' | 'sidebar-border' | 'footer-rule';

export type CVSectionKey =
  | 'summary'
  | 'objective'
  | 'experience'
  | 'education'
  | 'skills'
  | 'certifications'
  | 'languages'
  | 'projects'
  | 'awards'
  | 'publications'
  | 'volunteer'
  | 'references';

export interface CVPersonalInfo {
  fullName: string;
  professionalTitle: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
  photoUrl?: string;
}

export interface WorkExperienceItem {
  id: string;
  jobTitle: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
  achievements: string[];
}

export interface EducationItem {
  id: string;
  degree: string;
  institution: string;
  location: string;
  startDate: string;
  endDate: string;
  gpa?: string;
  honors?: string;
  coursework?: string;
}

export interface SkillItem {
  id: string;
  name: string;
  category: string;
  level: number; // 1 to 5
}

export interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  date: string;
  credentialId?: string;
}

export interface LanguageItem {
  id: string;
  name: string;
  proficiency: 'Native' | 'Fluent' | 'Professional' | 'Intermediate' | 'Basic';
}

export interface ProjectItem {
  id: string;
  name: string;
  role: string;
  date: string;
  url?: string;
  description: string;
  highlights: string[];
}

export interface AwardItem {
  id: string;
  title: string;
  issuer: string;
  date: string;
  description: string;
}

export interface PublicationItem {
  id: string;
  title: string;
  venue: string;
  year: string;
  authors: string;
  url?: string;
}

export interface VolunteerItem {
  id: string;
  role: string;
  organization: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface ReferenceItem {
  id: string;
  name: string;
  title: string;
  organization: string;
  email: string;
  phone: string;
  relationship: string;
}

export interface LayoutConfiguration {
  structure: LayoutStructure;
  sidebarWidth: number; // percentage 26-40
  headerStyle: HeaderStyle;
  showPhoto: boolean;
  photoShape: 'circle' | 'rounded' | 'square';
  sectionHeadingStyle: SectionHeadingStyle;
  bulletStyle: BulletStyle;
  skillDisplay: SkillDisplayStyle;
  timelineStyle: TimelineStyle;
  decorativeAccent: DecorativeAccent;
  showPageNumbers: boolean;
  headerText: string;
  footerText: string;
  sidebarSections?: CVSectionKey[];
}

export interface ColorConfiguration {
  presetName: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  sidebarBg: string;
  headerBg: string;
  headerText: string;
  text: string;
  mutedText: string;
  border: string;
}

export interface TypographyConfiguration {
  fontFamily: CVFontFamily;
  headingFontFamily: CVFontFamily;
  nameSize: number; // px
  headingSize: number; // px
  bodySize: number; // px
  fontWeight: '400' | '500' | '600' | '700';
  lineHeight: number;
  letterSpacing: number; // em
}

export interface PageConfiguration {
  size: 'A4' | 'LETTER';
  marginTop: number; // mm
  marginRight: number; // mm
  marginBottom: number; // mm
  marginLeft: number; // mm
  sectionSpacing: number; // px
  explicitPageBreaks: CVSectionKey[];
}

export interface DesignConfiguration {
  layout: LayoutConfiguration;
  colors: ColorConfiguration;
  typography: TypographyConfiguration;
  page: PageConfiguration;
}

export type TemplateCategory =
  | 'Classic Professional'
  | 'Modern Elegant'
  | 'Executive and Leadership'
  | 'NGO and International Development'
  | 'Academic and Research'
  | 'Creative and Digital'
  | 'Entry-Level';

export interface CVTemplate {
  templateId: string;
  name: string;
  category: TemplateCategory;
  profession: string;
  description: string;
  atsFriendly: boolean;
  tier: 'free' | 'premium';
  popularityScore: number;
  layoutConfiguration: LayoutConfiguration;
  colorConfiguration: ColorConfiguration;
  typographyConfiguration: TypographyConfiguration;
  previewConfiguration: {
    page: PageConfiguration;
    defaultSectionOrder: CVSectionKey[];
    sampleProfileKey: 'executive' | 'ngo' | 'academic' | 'tech' | 'graduate';
  };
  status: 'published' | 'draft';
  createdAt?: string;
  updatedAt?: string;
}

export interface CVDocument {
  cvId: string;
  userId: string;
  cvTitle: string;
  personalInformation: CVPersonalInfo;
  professionalSummary: string;
  careerObjective: string;
  workExperience: WorkExperienceItem[];
  education: EducationItem[];
  skills: SkillItem[];
  certifications: CertificationItem[];
  languages: LanguageItem[];
  projects: ProjectItem[];
  awards: AwardItem[];
  publications: PublicationItem[];
  volunteerExperience: VolunteerItem[];
  references: ReferenceItem[];
  sectionOrder: CVSectionKey[];
  hiddenSections: CVSectionKey[];
  sectionTitles: Record<CVSectionKey, string>;
  selectedTemplateId: string;
  designOverrides?: DesignConfiguration;
  attachedCoverPageId?: string;
  atsMode: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomDesign {
  designId: string;
  userId: string;
  name: string;
  description: string;
  designConfiguration: DesignConfiguration;
  createdAt: string;
  updatedAt: string;
}

export interface AIDesignHistoryEntry {
  historyId: string;
  userId: string;
  cvId?: string;
  prompt: string;
  rationale?: string;
  generatedConfiguration: DesignConfiguration;
  createdAt: string;
}

export interface UserActivity {
  id: string;
  action: string;
  targetName: string;
  timestamp: string;
}

export interface UserProfile {
  userId: string;
  fullName: string;
  email: string;
  role: 'user' | 'admin';
  defaultTitle?: string;
  location?: string;
  favoriteTemplateIds: string[];
  recentActivities: UserActivity[];
  createdAt: string;
  updatedAt: string;
}

export interface PlatformSettings {
  settingId: string;
  appName: string;
  tagline: string;
  defaultPrimaryColor: string;
  defaultSecondaryColor: string;
  aiEnabled: boolean;
  categories: string[];
  updatedAt: string;
}
