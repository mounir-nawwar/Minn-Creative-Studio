import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Search, Plus, Type, Zap, Video, Eye, FileDown, Pencil,
  Maximize, Sun, Clapperboard, Move, Film, Image as ImageIcon,
  Wand2, Scissors, Grid, BookOpen, Shield, Layout,
} from 'lucide-react';
import { useStore } from '../../store/useStore';

export default function NodesTab() {
  const { setPendingNodeType } = useStore();
  const [nodeSearch, setNodeSearch] = useState('');

  const nodeCategories = useMemo(() => [
    {
      label: 'Text / Prompt',
      nodes: [
        { type: 'prompt', label: 'Prompt Node', icon: Type, color: 'text-blue-400' },
        { type: 'promptLibrary', label: 'Prompt Library', icon: BookOpen, color: 'text-blue-300' },
        { type: 'directorPrompt', label: "Director's Prompt", icon: Clapperboard, color: 'text-purple-400' },
        { type: 'cameraControl', label: 'Camera Control', icon: Move, color: 'text-blue-400' },
        { type: 'promptConcatenator', label: 'Concatenator', icon: Plus, color: 'text-blue-500' },
        { type: 'promptEnhancer', label: 'Enhancer', icon: Zap, color: 'text-blue-300' },
        { type: 'llm', label: 'Run Any LLM', icon: Zap, color: 'text-indigo-400' },
        { type: 'vision', label: 'Image Describer', icon: Eye, color: 'text-indigo-300' },
        { type: 'videoDescriber', label: 'Video Describer', icon: Video, color: 'text-indigo-500' },
      ],
    },
    {
      label: 'Generation & Try-On',
      nodes: [
        { type: 'imageUpload', label: 'Image Upload', icon: ImageIcon, color: 'text-blue-400' },
        { type: 'videoUpload', label: 'Video Upload', icon: Video, color: 'text-blue-500' },
        { type: 'imagen', label: 'Image Generator', icon: ImageIcon, color: 'text-purple-400' },
        { type: 'inpainting', label: 'Inpainting (Virtual Try-On)', icon: Scissors, color: 'text-pink-400' },
        { type: 'styleTransfer', label: 'Style Transfer', icon: Wand2, color: 'text-purple-300' },
        { type: 'variation', label: 'Image Variations', icon: Grid, color: 'text-emerald-400' },
        { type: 'veo', label: 'Veo Video', icon: Video, color: 'text-red-400' },
        { type: 'imageToVideo', label: 'Image to Video', icon: Video, color: 'text-orange-400' },
        { type: 'lyria', label: 'Lyria Audio', icon: Zap, color: 'text-pink-400' },
      ],
    },
    {
      label: 'Editing & Sizing',
      nodes: [
        { type: 'batchOutputSizer', label: 'Batch Sizer (Social Ratios)', icon: Layout, color: 'text-cyan-400' },
        { type: 'levels', label: 'Levels', icon: ImageIcon, color: 'text-green-400' },
        { type: 'compositor', label: 'Compositor', icon: ImageIcon, color: 'text-green-600' },
        { type: 'painter', icon: Pencil, label: 'Painter', color: 'text-green-200' },
        { type: 'crop', label: 'Crop', icon: ImageIcon, color: 'text-green-500' },
        { type: 'resize', label: 'Resize', icon: ImageIcon, color: 'text-green-300' },
        { type: 'blur', label: 'Blur', icon: ImageIcon, color: 'text-emerald-400' },
        { type: 'invert', label: 'Invert', icon: ImageIcon, color: 'text-emerald-500' },
        { type: 'channels', label: 'Channels', icon: ImageIcon, color: 'text-emerald-300' },
      ],
    },
    {
      label: 'Enhancement',
      nodes: [
        { type: 'imageUpscaler', label: 'Image Upscaler', icon: Maximize, color: 'text-orange-400' },
        { type: 'videoUpscaler', label: 'Video Upscaler', icon: Video, color: 'text-orange-500' },
        { type: 'frameInterpolator', label: 'Frame Interpolator', icon: Zap, color: 'text-orange-300' },
        { type: 'relight', label: 'Relight AI', icon: Sun, color: 'text-yellow-500' },
      ],
    },
    {
      label: 'Matte / Masking',
      nodes: [
        { type: 'maskExtractor', label: 'Mask Extractor', icon: ImageIcon, color: 'text-cyan-400' },
        { type: 'maskByText', label: 'Mask By Text', icon: Type, color: 'text-cyan-500' },
        { type: 'videoMatte', label: 'Video Matte', icon: Video, color: 'text-cyan-600' },
        { type: 'videoMaskByText', label: 'Video Mask By Text', icon: Type, color: 'text-cyan-200' },
        { type: 'matteAdjust', label: 'Matte Adjust', icon: ImageIcon, color: 'text-cyan-300' },
        { type: 'mergeAlpha', label: 'Merge Alpha', icon: ImageIcon, color: 'text-cyan-600' },
      ],
    },
    {
      label: 'Iterators',
      nodes: [
        { type: 'textIterator', label: 'Text Iterator', icon: Plus, color: 'text-orange-500' },
        { type: 'imageIterator', label: 'Image Iterator', icon: ImageIcon, color: 'text-orange-400' },
        { type: 'videoIterator', label: 'Video Iterator', icon: Video, color: 'text-orange-600' },
      ],
    },
    {
      label: 'Data & Brand Control',
      nodes: [
        { type: 'brandContext', label: 'Brand Context', icon: Shield, color: 'text-yellow-400' },
        { type: 'number', label: 'Number', icon: Plus, color: 'text-blue-400' },
        { type: 'text', label: 'Text', icon: Type, color: 'text-blue-400' },
        { type: 'toggle', label: 'Toggle', icon: Zap, color: 'text-blue-400' },
        { type: 'listSelector', label: 'List Selector', icon: FileDown, color: 'text-blue-400' },
        { type: 'seed', label: 'Seed', icon: Zap, color: 'text-blue-500' },
        { type: 'array', label: 'Array', icon: FileDown, color: 'text-blue-500' },
        { type: 'guidanceStrength', label: 'Guidance', icon: Plus, color: 'text-blue-300' },
        { type: 'motionIntensity', label: 'Motion', icon: Video, color: 'text-blue-300' },
        { type: 'cfgScale', label: 'CFG Scale', icon: Plus, color: 'text-blue-200' },
      ],
    },
    {
      label: 'Helpers',
      nodes: [
        { type: 'stickyNote', label: 'Sticky Note', icon: Type, color: 'text-yellow-200' },
        { type: 'compare', label: 'Compare', icon: Eye, color: 'text-blue-200' },
        { type: 'sequence', label: 'Video Sequence', icon: Film, color: 'text-pink-500' },
        { type: 'output', label: 'Output Collector', icon: FileDown, color: 'text-[#0097A7]' },
      ],
    },
  ], []);

  const filteredCategories = useMemo(() => {
    if (!nodeSearch.trim()) return nodeCategories;
    const search = nodeSearch.toLowerCase();
    return nodeCategories
      .map((category) => ({
        ...category,
        nodes: category.nodes.filter(
          (node) => node.label.toLowerCase().includes(search) || node.type.toLowerCase().includes(search),
        ),
      }))
      .filter((category) => category.nodes.length > 0);
  }, [nodeCategories, nodeSearch]);

  return (
    <motion.div
      key="nodes"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="flex flex-1 flex-col overflow-hidden"
    >
      <div className="p-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search nodes"
            value={nodeSearch}
            onChange={(e) => setNodeSearch(e.target.value)}
            className="w-full rounded-lg bg-white/[0.04] py-2 pl-9 pr-3 text-[13px] text-white placeholder:text-gray-600 ring-1 ring-white/10 transition-shadow duration-150 focus:outline-none focus:ring-[1.5px] focus:ring-[#0097A7]/60"
          />
        </div>
      </div>

      <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {filteredCategories.length === 0 ? (
          <p className="py-10 text-center text-xs text-gray-600">No nodes found</p>
        ) : (
          filteredCategories.map((category) => (
            <div key={category.label} className="space-y-1.5">
              <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">{category.label}</p>
              <div className="space-y-1">
                {category.nodes.map((item) => (
                  <button
                    key={item.type}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', item.type);
                      e.dataTransfer.setData('application/json', JSON.stringify({
                        type: item.type,
                        label: item.label,
                      }));
                      e.dataTransfer.effectAllowed = 'move';
                      setPendingNodeType(item.type, { label: item.label, type: item.type as any, config: {} });
                    }}
                    onClick={() => setPendingNodeType(item.type, { label: item.label, type: item.type as any, config: {} })}
                    className="group flex w-full cursor-grab items-center gap-3 rounded-lg bg-white/[0.03] p-2 ring-1 ring-white/10 transition-[transform,background-color,box-shadow] duration-150 hover:bg-white/[0.05] hover:ring-white/20 active:cursor-grabbing active:scale-[0.98]"
                  >
                    <span className={`flex h-7 w-7 items-center justify-center rounded-md bg-black/40 ${item.color}`}>
                      <item.icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex-1 text-left text-[13px] font-medium text-gray-300">{item.label}</span>
                    <Plus className="h-3.5 w-3.5 text-gray-700 transition-colors group-hover:text-[#0097A7]" />
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}