import React from 'react';
import { 
  Type, 
  Image as ImageIcon, 
  Zap, 
  Video, 
  Eye, 
  FileDown,
  Plus,
  Pencil,
  Maximize,
  Sun
} from 'lucide-react';
import { useStore } from '../store/useStore';

const Sidebar = () => {
  const addNode = useStore((state) => state.addNode);

  const nodeCategories = [
    {
      label: 'Text / Prompt',
      nodes: [
        { type: 'prompt', label: 'Prompt Node', icon: Type, color: 'text-blue-400' },
        { type: 'promptConcatenator', label: 'Concatenator', icon: Plus, color: 'text-blue-500' },
        { type: 'promptEnhancer', label: 'Enhancer', icon: Zap, color: 'text-blue-300' },
        { type: 'llm', label: 'Run Any LLM', icon: Zap, color: 'text-indigo-400' },
        { type: 'vision', label: 'Image Describer', icon: Eye, color: 'text-indigo-300' },
        { type: 'videoDescriber', label: 'Video Describer', icon: Video, color: 'text-indigo-500' },
      ]
    },
    {
      label: 'Generation',
      nodes: [
        { type: 'imagen', label: 'Image Generator', icon: ImageIcon, color: 'text-purple-400' },
        { type: 'veo', label: 'Veo Video', icon: Video, color: 'text-red-400' },
        { type: 'imageToVideo', label: 'Image to Video', icon: Video, color: 'text-orange-400' },
        { type: 'lyria', label: 'Lyria Audio', icon: Zap, color: 'text-pink-400' },
      ]
    },
    {
      label: 'Editing Tools',
      nodes: [
        { type: 'levels', label: 'Levels', icon: ImageIcon, color: 'text-green-400' },
        { type: 'compositor', label: 'Compositor', icon: ImageIcon, color: 'text-green-600' },
        { type: 'painter', icon: Pencil, label: 'Painter', color: 'text-green-200' },
        { type: 'crop', label: 'Crop', icon: ImageIcon, color: 'text-green-500' },
        { type: 'resize', label: 'Resize', icon: ImageIcon, color: 'text-green-300' },
        { type: 'blur', label: 'Blur', icon: ImageIcon, color: 'text-emerald-400' },
        { type: 'invert', label: 'Invert', icon: ImageIcon, color: 'text-emerald-500' },
        { type: 'channels', label: 'Channels', icon: ImageIcon, color: 'text-emerald-300' },
      ]
    },
    {
      label: 'Enhancement',
      nodes: [
        { type: 'imageUpscaler', label: 'Image Upscaler', icon: Maximize, color: 'text-orange-400' },
        { type: 'videoUpscaler', label: 'Video Upscaler', icon: Video, color: 'text-orange-500' },
        { type: 'frameInterpolator', label: 'Frame Interpolator', icon: Zap, color: 'text-orange-300' },
        { type: 'relight', label: 'Relight AI', icon: Sun, color: 'text-yellow-500' },
      ]
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
      ]
    },
    {
      label: 'Iterators',
      nodes: [
        { type: 'textIterator', label: 'Text Iterator', icon: Plus, color: 'text-orange-500' },
        { type: 'imageIterator', label: 'Image Iterator', icon: ImageIcon, color: 'text-orange-400' },
        { type: 'videoIterator', label: 'Video Iterator', icon: Video, color: 'text-orange-600' },
      ]
    },
    {
      label: 'Data / Control',
      nodes: [
        { type: 'number', label: 'Number', icon: Plus, color: 'text-blue-400' },
        { type: 'text', label: 'Text', icon: Type, color: 'text-blue-400' },
        { type: 'toggle', label: 'Toggle', icon: Zap, color: 'text-blue-400' },
        { type: 'listSelector', label: 'List Selector', icon: FileDown, color: 'text-blue-400' },
        { type: 'seed', label: 'Seed', icon: Zap, color: 'text-blue-500' },
        { type: 'array', label: 'Array', icon: FileDown, color: 'text-blue-500' },
        { type: 'guidanceStrength', label: 'Guidance', icon: Plus, color: 'text-blue-300' },
        { type: 'motionIntensity', label: 'Motion', icon: Video, color: 'text-blue-300' },
        { type: 'cfgScale', label: 'CFG Scale', icon: Plus, color: 'text-blue-200' },
      ]
    },
    {
      label: 'Helpers',
      nodes: [
        { type: 'stickyNote', label: 'Sticky Note', icon: Type, color: 'text-yellow-200' },
        { type: 'compare', label: 'Compare', icon: Eye, color: 'text-blue-200' },
        { type: 'output', label: 'Output Collector', icon: FileDown, color: 'text-[#0097A7]' },
      ]
    }
  ];

  const handleAddNode = (type: string, label: string) => {
    const id = `${type}-${Date.now()}`;
    addNode({
      id,
      type,
      position: { x: 100, y: 100 },
      data: { label, type: type as any, config: {} },
    });
  };

  return (
    <div className="w-64 bg-[#111111] border-r border-[#1a1a1a] flex flex-col h-full">
      <div className="p-6 border-b border-[#1a1a1a]">
        <h1 className="text-xl font-black text-white tracking-tighter flex items-center gap-2">
          MINN <span className="text-[#0097A7]">STUDIO</span>
        </h1>
        <p className="text-[10px] text-gray-500 uppercase font-bold mt-1 tracking-widest">AI Workflow Builder</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        {nodeCategories.map((category) => (
          <div key={category.label} className="space-y-2">
            <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-3">{category.label}</p>
            <div className="space-y-2">
              {category.nodes.map((item) => (
                <button
                  key={item.type}
                  onClick={() => handleAddNode(item.type, item.label)}
                  className="w-full flex items-center gap-3 p-2 bg-[#1a1a1a] hover:bg-[#222222] border border-[#2a2a2a] rounded-xl transition-all group"
                >
                  <div className={`p-1.5 bg-black rounded-lg ${item.color} group-hover:scale-110 transition-transform`}>
                    <item.icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[11px] font-bold text-gray-300">{item.label}</p>
                  </div>
                  <Plus className="w-3 h-3 text-gray-700 group-hover:text-[#0097A7] transition-colors" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-[#0a0a0a] border-t border-[#1a1a1a]">
        <div className="p-3 bg-[#111111] border border-[#1a1a1a] rounded-xl">
          <p className="text-[9px] text-gray-600 uppercase font-bold mb-1">System Status</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-gray-400 font-bold">All Models Online</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
