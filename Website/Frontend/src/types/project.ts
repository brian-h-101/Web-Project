export interface ArchitectureStep {
  name: string;
  description: string;
}
export interface DemoInstruction {
  text: string;
  linkedProjectSlug?: string;
}
export interface Project {
  slug: string;
  name: string;
  description: string;
  overview: string;
  contribution: string;
  engineeringFocus: string;
  technologies: string[];
  demoUrl: string;
  recommendedDemoUrl?: string;
  demoKind: 'commerce' | 'filesystem' | 'crpg';
  status: string;
  summaryFlow: string[];
  sourceUrl?: string;
  features: string[];
  architecture: ArchitectureStep[];
  stores: ArchitectureStep[];
  architectureNote: string;
  architectureCaption?: string;
  architectureVertical?: boolean;
  architectureGroups?: ArchitectureStep[];
  implementation: { title: string; detail: string }[];
  frameworkState?: {
    intro: string;
    authoring?: {
      title: string;
      detail: string;
      rulesEngine: string;
      image: {
        src: string;
        alt: string;
        caption: string;
        width: number;
        height: number;
      };
    };
    sections: {
      title: string;
      detail: string;
    }[];
  };
  demoSteps: DemoInstruction[];
  testing: { title: string; detail: string }[];
  historicalVerification?: { date: string; title: string; detail: string }[];
  limitations: string;
  improvement: string;
}

