export type CoverPageFontFamily =
  | 'Inter'
  | 'Montserrat'
  | 'Lato'
  | 'Roboto'
  | 'Open Sans'
  | 'Arial'
  | 'Georgia'
  | 'Garamond'
  | 'Playfair Display';

export type CoverPageCategory =
  | 'Executive and Corporate'
  | 'NGO and International Development'
  | 'Modern and Elegant'
  | 'Academic and Research'
  | 'Creative and Portfolio';

export type CoverPageSize = 'A4' | 'LETTER' | 'CUSTOM';

export type CoverPatternType =
  | 'none'
  | 'grid'
  | 'dots'
  | 'diagonal'
  | 'rings'
  | 'waves'
  | 'hexagons';

export type CoverBackgroundType =
  | 'solid'
  | 'gradient'
  | 'image'
  | 'pattern-geometric'
  | 'pattern-abstract'
  | 'minimal-white';

export type CoverElementType =
  | 'text'
  | 'photo'
  | 'personalLogo'
  | 'companyLogo'
  | 'colorBlock'
  | 'shape'
  | 'line'
  | 'icon';

export type CoverPersonalFieldKey =
  | 'fullName'
  | 'professionalTitle'
  | 'professionalSubtitle'
  | 'email'
  | 'phone'
  | 'location'
  | 'website'
  | 'linkedin'
  | 'cvTitle'
  | 'tagline'
  | 'careerSpecialty'
  | 'introduction'
  | 'documentDate'
  | 'targetOrganization';

export interface CoverPagePersonalInfo {
  fullName: string;
  professionalTitle: string;
  professionalSubtitle: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  linkedin: string;
  cvTitle: string;
  tagline: string;
  careerSpecialty: string;
  introduction: string;
  documentDate: string;
  targetOrganization: string;
}

export interface CoverImageCrop {
  zoom: number;
  offsetX: number;
  offsetY: number;
  shape: 'circle' | 'square' | 'rounded';
  backgroundRemoved?: boolean;
}

export interface CoverElementStyle {
  fontFamily?: CoverPageFontFamily;
  fontSize?: number; // px on 794px-wide base canvas
  fontWeight?: '400' | '500' | '600' | '700' | '800';
  fontStyle?: 'normal' | 'italic';
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  textAlign?: 'left' | 'center' | 'right';
  letterSpacing?: number; // em
  lineHeight?: number;
  textTransform?: 'none' | 'uppercase' | 'capitalize';
  padding?: number;
}

export interface CoverCanvasElement {
  id: string;
  type: CoverElementType;
  label: string;
  fieldBinding?: CoverPersonalFieldKey | 'contactLine';
  text?: string;
  src?: string;
  shapeKind?: 'rectangle' | 'circle' | 'rounded' | 'triangle' | 'diamond' | 'pill';
  iconName?: 'briefcase' | 'award' | 'globe' | 'book' | 'sparkles' | 'compass' | 'layers' | 'shield';
  x: number; // percentage 0..100
  y: number; // percentage 0..100
  width: number; // percentage 1..100
  height: number; // percentage 0.5..100
  zIndex: number;
  locked?: boolean;
  rotation?: number; // degrees
  opacity?: number; // 0..1
  style: CoverElementStyle;
  crop?: CoverImageCrop;
}

export interface CoverBackgroundConfig {
  type: CoverBackgroundType;
  primaryColor: string;
  secondaryColor: string;
  gradientAngle: number;
  imageUrl?: string;
  imageOpacity?: number;
  patternType?: CoverPatternType;
  patternColor?: string;
  patternOpacity?: number;
  marginMm: number;
  showBleedGuides: boolean;
}

export interface CoverPageDesignConfiguration {
  colorSchemeName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  mutedTextColor: string;
  fontFamily: CoverPageFontFamily;
  headingFontFamily: CoverPageFontFamily;
  alignment: 'left' | 'center' | 'right';
  customWidthMm?: number;
  customHeightMm?: number;
  elements: CoverCanvasElement[];
}

export interface CoverUploadedImages {
  profilePhoto?: string;
  personalLogo?: string;
  companyLogo?: string;
  backgroundImage?: string;
}

export interface CoverPageDocument {
  coverPageId: string;
  userId: string;
  cvId?: string;
  templateId: string;
  title: string;
  personalInformation: CoverPagePersonalInfo;
  designConfiguration: CoverPageDesignConfiguration;
  backgroundConfiguration: CoverBackgroundConfig;
  uploadedImages: CoverUploadedImages;
  pageSize: CoverPageSize;
  createdAt: string;
  updatedAt: string;
}

export interface CoverPageTemplatePreviewConfig {
  backgroundConfiguration: CoverBackgroundConfig;
  defaultPageSize: CoverPageSize;
  featured?: boolean;
  previewImageUrl?: string;
  samplePersonalInfo: CoverPagePersonalInfo;
}

export interface CoverPageTemplate {
  templateId: string;
  templateName: string;
  category: CoverPageCategory;
  description: string;
  designConfiguration: CoverPageDesignConfiguration;
  previewConfiguration: CoverPageTemplatePreviewConfig;
  status: 'published' | 'draft' | 'archived';
  createdAt?: string;
  updatedAt?: string;
}

export interface CoverColorScheme {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  muted: string;
  bg: string;
}
