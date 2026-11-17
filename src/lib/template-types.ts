export type TemplateStatus = "draft" | "pending_review" | "published" | "rejected" | "suspended";

export type ExamplePair = {
  id: string;
  inputImage: string;
  outputImage: string;
};

export type TemplateSource = {
  platform: "xiaohongshu" | "other";
  url?: string;
  author?: string;
  rightsStatus: "reference_only" | "authorized" | "self_created";
  rawText?: string;
  collectedAt: string;
};

export type TemplateTranslations = {
  en?: {
    name?: string;
    tagline?: string;
    description?: string;
    category?: string;
    tags?: string[];
    textPlaceholder?: string;
  };
};

export type StudioTemplate = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  tags: string[];
  coverImage: string;
  examples: ExamplePair[];
  allowText: boolean;
  allowImage: boolean;
  textPlaceholder: string;
  outputRatio: string;
  outputSize: string;
  allowedCounts: number[];
  priceCredits: number;
  providerId: string;
  model: string;
  privatePrompt: string;
  negativePrompt: string;
  status: TemplateStatus;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  source?: TemplateSource;
  ownerType?: "platform" | "creator";
  ownerUserId?: string;
  creatorName?: string;
  creatorRewardFen?: number;
  reviewReason?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  translations?: TemplateTranslations;
};

export type PublicTemplate = Omit<
  StudioTemplate,
  | "privatePrompt"
  | "negativePrompt"
  | "providerId"
  | "model"
  | "source"
  | "ownerUserId"
  | "creatorRewardFen"
  | "reviewReason"
  | "reviewedAt"
  | "reviewedBy"
>;

export function toPublicTemplate(template: StudioTemplate): PublicTemplate {
  const publicTemplate: Partial<StudioTemplate> = { ...template };
  delete publicTemplate.privatePrompt;
  delete publicTemplate.negativePrompt;
  delete publicTemplate.providerId;
  delete publicTemplate.model;
  delete publicTemplate.source;
  delete publicTemplate.ownerUserId;
  delete publicTemplate.creatorRewardFen;
  delete publicTemplate.reviewReason;
  delete publicTemplate.reviewedAt;
  delete publicTemplate.reviewedBy;
  return publicTemplate as PublicTemplate;
}
