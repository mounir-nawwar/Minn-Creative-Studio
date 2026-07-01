import { useState } from 'react';
import { Layout, MessageSquare, Image as ImageIcon, Box, PanelLeftClose } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useProjectStore } from '../store/useProjectStore';
import AssetGrid from './AssetGrid';
import AssetPreviewModal from './AssetPreviewModal';
import { Asset } from '../types/project.types';
import NodesTab from './Sidebar/NodesTab';
import WorkflowsTab from './Sidebar/WorkflowsTab';
import ChatsTab from './Sidebar/ChatsTab';

type Tab = 'nodes' | 'workflows' | 'chats' | 'assets';

const TABS: { id: Tab; icon: typeof Box }[] = [
  { id: 'nodes', icon: Box },
  { id: 'workflows', icon: Layout },
  { id: 'chats', icon: MessageSquare },
  { id: 'assets', icon: ImageIcon },
];

export default function ProjectSidebar() {
  const { currentProject, toggleSidebar, isSidebarOpen } = useProjectStore();
  const [activeTab, setActiveTab] = useState<Tab>('nodes');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  if (!currentProject) return null;

  return (
    <motion.div
      initial={false}
      animate={{ width: isSidebarOpen ? 320 : 0, opacity: isSidebarOpen ? 1 : 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      className="relative z-50 flex h-full flex-col overflow-hidden border-r border-white/5 bg-[#0a0a0a]"
    >
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/5 p-2">
        <div className="flex flex-1 gap-1">
          {TABS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg py-2.5 transition-[color,background-color] duration-150 ${
                activeTab === id ? 'bg-white/[0.06] text-[#0097A7]' : 'text-gray-500 hover:bg-white/[0.03] hover:text-gray-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[10px] font-medium capitalize">{id}</span>
            </button>
          ))}
        </div>
        <button
          onClick={toggleSidebar}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-[transform,color,background-color] duration-150 hover:bg-white/5 hover:text-white active:scale-[0.96]"
          title="Close sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'nodes' && <NodesTab key="nodes" />}
          {activeTab === 'workflows' && <WorkflowsTab key="workflows" />}
          {activeTab === 'chats' && <ChatsTab key="chats" />}
          {activeTab === 'assets' && (
            <motion.div
              key="assets"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <AssetGrid onAssetClick={setSelectedAsset} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AssetPreviewModal
        asset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
        onDelete={() => {}}
        onToggleFavorite={() => {}}
      />

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-white/5 bg-[#0d0d0d] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#0097A7]" />
          <span className="text-[11px] font-medium text-gray-400">Project active</span>
        </div>
        <span className="text-[11px] tabular-nums text-gray-600">v1.0.4</span>
      </div>
    </motion.div>
  );
}
