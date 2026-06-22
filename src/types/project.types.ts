// Project types for Minn Creative Studio
// No Firebase dependencies - uses ISO date strings

export type ProjectStatus = 'active' | 'archived' | 'completed';

export type FontStyle = 'geometric' | 'serif' | 'handwritten' | 'monospace' | 'display' | 'mixed';

export type AssetType = 'image' | 'video' | 'audio' | 'document' | 'reference';

export interface ProjectUsage {
  totalCost: number;
  textCost: number;
  imageCost: number;
  videoCost: number;
  audioCost: number;
  totalTokens: number;
  totalImages: number;
  totalVideos: number;
  totalAudio: number;
  lastUpdated?: string; // ISO date string
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  type: string;
  subtype: string;
  status: ProjectStatus;
  userId: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  coverImage?: string;
  
  // Soft delete fields
  deletedAt?: string; // ISO date string
  deletedBy?: string;
  
  // Brand / Client Info
  clientName?: string;
  clientWebsite?: string;
  clientIndustry?: string;
  
  // AI System Instructions
  aiInstructions: string;
  brandPersonality?: string;
  targetAudience?: string;
  
  // Visual Identity
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontStyle: FontStyle;
  visualMood: string[];
  negativeKeywords: string;
  styleKeywords: string;
  
  // Platform Targets
  platforms: string[];
  outputFormats: string[];
  
  // Deliverables
  deliverables?: string;
  deadline?: string; // ISO date string
  budget?: string;
  
  // Tags
  tags: string[];
  
  // Sharing
  collaborators: string[];
  
  // Usage & Cost Tracking
  usage?: ProjectUsage;
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  url: string;
  thumbnailUrl?: string;
  tags: string[];
  nodeId?: string;
  workflowId?: string;
  createdAt: string; // ISO date string
  isFavorited: boolean;
  deletedAt?: string; // ISO date string
  deletedBy?: string;
  metadata: {
    width?: number;
    height?: number;
    duration?: number;
    model?: string;
    prompt?: string;
    seed?: number;
    [key: string]: any;
  };
}

export const PROJECT_TYPES = {
  marketing: {
    label: "Marketing Campaign",
    icon: "📣",
    subtypes: ["Social Media Campaign", "Email Campaign", "Paid Ads", "Brand Awareness", "Product Launch", "Seasonal Campaign"]
  },
  fashion: {
    label: "Fashion & Apparel",
    icon: "👗",
    subtypes: ["Lookbook", "Editorial", "E-commerce Shoot", "Collection Launch", "Brand Identity", "Runway"]
  },
  advertising: {
    label: "Advertising",
    icon: "📺",
    subtypes: ["TV Commercial", "Digital Ad", "Billboard", "Print Ad", "Influencer Brief", "UGC Campaign"]
  },
  branding: {
    label: "Brand Identity",
    icon: "✦",
    subtypes: ["Brand Guidelines", "Logo & Identity", "Brand Refresh", "Rebranding", "Sub-brand"]
  },
  content: {
    label: "Content Creation",
    icon: "🎬",
    subtypes: ["Instagram Feed", "Reels / TikTok", "YouTube", "Blog Visuals", "Podcast Cover", "Newsletter"]
  },
  product: {
    label: "Product Photography",
    icon: "📦",
    subtypes: ["Hero Shots", "Lifestyle", "Detail Shots", "Packaging", "360 View", "Ghost Mannequin"]
  },
  architecture: {
    label: "Architecture & Interior",
    icon: "🏛",
    subtypes: ["Exterior Render", "Interior Render", "Staging", "Renovation Concept", "Landscape"]
  },
  film: {
    label: "Film & Video",
    icon: "🎥",
    subtypes: ["Short Film", "Music Video", "Documentary", "Storyboard", "Concept Reel", "VFX Concept"]
  },
  events: {
    label: "Events",
    icon: "🎪",
    subtypes: ["Event Promo", "Wedding", "Corporate Event", "Concert", "Exhibition"]
  },
  personal: {
    label: "Personal / Experimental",
    icon: "⚡",
    subtypes: ["Art Project", "Portfolio", "Personal Brand", "Exploration", "Other"]
  }
};
