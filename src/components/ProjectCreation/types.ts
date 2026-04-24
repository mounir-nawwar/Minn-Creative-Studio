import { Project, ProjectStatus } from '../../types/project.types';
import { Instagram, Youtube, Globe, Facebook, Linkedin, Mail, Printer, Smartphone } from 'lucide-react';
import type { FC } from 'react';

export type { Project, ProjectStatus };

export interface StepProps {
  formData: Partial<Project>;
  updateFormData: (updates: Partial<Project>) => void;
  toggleItem: (field: keyof Project, item: string) => void;
}

export const MOODS = [
  'Minimal', 'Bold', 'Luxury', 'Playful', 'Dark', 'Vibrant', 'Soft', 'Raw',
  'Corporate', 'Cinematic', 'Editorial', 'Futuristic', 'Natural', 'Retro', 'Abstract'
];

export const TONES = [
  'Professional', 'Friendly', 'Luxurious', 'Bold', 'Playful', 'Minimalist',
  'Authoritative', 'Warm', 'Edgy', 'Inspirational'
];

export const PLATFORMS: { id: string; label: string; icon: FC<{ className?: string }> }[] = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'tiktok', label: 'TikTok', icon: Smartphone },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'facebook', label: 'Facebook', icon: Facebook },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { id: 'website', label: 'Website', icon: Globe },
  { id: 'print', label: 'Print', icon: Printer },
  { id: 'email', label: 'Email', icon: Mail },
];
