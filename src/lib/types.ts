export type ProjectStatus = 'ongoing' | 'archived';
export type ArticleKind = 'spec' | 'devlog' | 'tool' | 'interview' | 'job' | 'resume' | 'essay';

export interface Settings {
  siteTitle: string;
  siteSubtitle: string;
  ownerName: string;
  ownerInitial: string;
  identity: string;
  bio: string;
  status: string;
  github: string;
  email: string;
  location: string;
  adminTitle: string;
}

export interface ProjectProgress {
  label: string;
  value: number;
}

export interface Project {
  slug: string;
  name: string;
  summary: string;
  status: ProjectStatus;
  statusLabel: string;
  tech: string[];
  progress: ProjectProgress[];
  monthUpdate: string;
  releaseNote: string;
  architecture: string[];
  featured: boolean;
}

export interface Article {
  slug: string;
  title: string;
  date: string;
  kind: ArticleKind;
  category: string;
  projectSlug: string;
  lifecycle: ProjectStatus | '';
  tags: string[];
  excerpt: string;
  content: string;
  company?: string;
  position?: string;
}
