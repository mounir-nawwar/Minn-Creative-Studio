import { Timestamp, FieldValue } from 'firebase/firestore';

export type ProjectStatus = 'active' | 'archived' | 'completed';

export type FontStyle = 'geometric' | 'serif' | 'handwritten' | 'monospace' | 'display' | 'mixed';

export type AssetType = 'image' | 'video' | 'audio' | 'document' | 'reference';

export interface Project {
  id: string;
  name: string;
  description?: string;
  type: string;
  subtype: string;
  status: ProjectStatus;
  userId: string;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  coverImage?: string;
  
  // Soft delete fields
  deletedAt?: Timestamp | FieldValue;
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
  deadline?: Timestamp | FieldValue;
  budget?: string;
  
  // Tags
  tags: string[];
  
  // Sharing
  collaborators: string[];
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
  createdAt: Timestamp;
  isFavorited: boolean;
  deletedAt?: Timestamp | FieldValue;
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
