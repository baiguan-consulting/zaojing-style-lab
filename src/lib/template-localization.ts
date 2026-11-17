import type { Locale } from "./locale";
import type { PublicTemplate } from "./template-types";

type EnglishTemplateCopy = {
  name: string;
  tagline: string;
  description: string;
  category: string;
  tags: string[];
  textPlaceholder: string;
};

const CATEGORY_EN: Record<string, string> = {
  "建筑艺术": "Architecture",
  "人像写真": "Portrait",
  "产品电商": "Product Design",
  "宠物创作": "Pet Art",
  "创意设计": "Creative Design",
  "艺术插画": "Illustration",
  "艺术海报": "Art Poster",
  "旅行艺术": "Travel Art",
};

const LEGACY_ENGLISH_COPY: Record<string, EnglishTemplateCopy> = {
  "style-3-4-mwiuakx4": {
    name: "Vintage Hand-Drawn Style",
    tagline: "Turn portraits and architecture into nostalgic hand-drawn artwork",
    description: "Reimagine a person, building, or everyday scene with warm vintage drawing, tactile linework, and a softly aged editorial finish.",
    category: "Architecture",
    tags: ["Vintage", "Hand Drawn"],
    textPlaceholder: "Describe the subject, setting, or details you want to preserve",
  },
  "万物变点云线框-附ai提示词": {
    name: "Point-Cloud Wireframe",
    tagline: "Transform any subject into a luminous point-cloud wireframe",
    description: "Preserve the subject's defining silhouette and pose, then rebuild the whole image with glowing points, fine spatial lines, and a clean technological atmosphere.",
    category: "Portrait",
    tags: ["Point Cloud", "Wireframe", "Digital Art"],
    textPlaceholder: "Describe the subject, pose, setting, or details to preserve",
  },
  "perler-bead-landmark": {
    name: "Perler-Bead Landmarks",
    tagline: "Build iconic architecture from tiny, tactile beads",
    description: "Keep the landmark's recognizable silhouette and structure while rebuilding it as a charming three-dimensional model made from clearly visible fuse beads.",
    category: "Architecture",
    tags: ["Landmarks", "Perler Beads", "Handmade", "Miniature"],
    textPlaceholder: "Enter a landmark, preferred viewpoint, palette, or surrounding elements",
  },
  "vertical-slice-sculpture": {
    name: "Layered Slice Sculpture",
    tagline: "Turn everyday subjects into luminous layered sculptures",
    description: "Extract the subject, pose, and key setting, then reconstruct them from dense vertical slices with a complete silhouette, airy gaps, and dimensional light.",
    category: "Art Poster",
    tags: ["Slice Sculpture", "Layered Art", "Editorial Poster"],
    textPlaceholder: "Describe a person, animal, object, or scene and the pose or colors to preserve",
  },
  "travel-art-poster": {
    name: "Light Travel Art Poster",
    tagline: "Turn travel landmarks into bright, airy minimalist art",
    description: "Extract the landmark, spatial depth, and memorable colors from a travel photo, then reinterpret them with soft gradients, flowing curves, and editorial negative space.",
    category: "Travel Art",
    tags: ["Travel", "Art Poster", "Minimal Illustration", "Gradient"],
    textPlaceholder: "Describe the landmark, light, or travel mood you want to preserve",
  },
  "glass-art-diptych": {
    name: "Translucent Glass Art",
    tagline: "Cast familiar subjects in luminous sculpted glass",
    description: "Preserve the subject's defining shape, gesture, and colors while reshaping the full scene as a translucent glass-art editorial poster with restrained negative space.",
    category: "Art Poster",
    tags: ["Glass Art", "Editorial", "Transparent Sculpture", "Soft Light"],
    textPlaceholder: "Describe the subject, gesture, setting, or colors you want to preserve",
  },
  "low-poly-origami-pet": {
    name: "Low-Poly Origami Pets",
    tagline: "Fold your pet's personality into a lively paper character",
    description: "Preserve your pet's markings, expression, and movement, then transform the full subject into a dimensional paper character with crisp polygonal folds.",
    category: "Pet Art",
    tags: ["Pets", "Origami", "Low Poly", "Paper Character"],
    textPlaceholder: "Optional: describe an action or add a very short caption",
  },
  "vintage-travel-stamp": {
    name: "Vintage Travel Stamp",
    tagline: "Keep a travel memory inside a handmade stamp",
    description: "Extract the most recognizable subject and colors from a photo, then turn them into a collectible travel stamp with paper grain, colored-pencil marks, and vintage print imperfections.",
    category: "Travel Art",
    tags: ["Vintage", "Stamp", "Travel", "Hand Drawn"],
    textPlaceholder: "For example: keep the boat on the lake and make the mood quieter and softer",
  },
};

export function localizeTemplate(template: PublicTemplate, locale: Locale): PublicTemplate {
  if (locale !== "en") return template;
  const saved = template.translations?.en;
  const fallback = LEGACY_ENGLISH_COPY[template.slug];
  return {
    ...template,
    name: saved?.name || fallback?.name || template.name,
    tagline: saved?.tagline || fallback?.tagline || template.tagline,
    description: saved?.description || fallback?.description || template.description,
    category: saved?.category || fallback?.category || CATEGORY_EN[template.category] || template.category,
    tags: saved?.tags?.length ? saved.tags : fallback?.tags || template.tags,
    textPlaceholder: saved?.textPlaceholder || fallback?.textPlaceholder || template.textPlaceholder,
  };
}

export function localizeTemplates(templates: PublicTemplate[], locale: Locale) {
  return templates.map((template) => localizeTemplate(template, locale));
}
