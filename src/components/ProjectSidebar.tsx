import React, { useState } from 'react';
import {
  Layout,
  MessageSquare,
  Image as ImageIcon,
  Box,
  PanelLeftClose
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useProjectStore } from '../store/useProjectStore';
import AssetGrid from './AssetGrid';
import AssetPreviewModal from './AssetPreviewModal';
import { Asset } from '../types/project.types';
import NodesTab from './Sidebar/NodesTab';
import WorkflowsTab from './Sidebar/WorkflowsTab';
import ChatsTab from './Sidebar/ChatsTab';

type Tab = 'nodes' | 'workflows' | 'chats' | 'assets';

export default function ProjectSidebar() {
  const { currentProject, toggleSidebar, isSidebarOpen } = useProjectStore();
  const [activeTab, setActiveTab] = useState<Tab>('nodes');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  if (!currentProject) return null;

  return (
    <motion.div
      initial={false}
      animate={{ width: isSidebarOpen ? 320 : 0, opacity: isSidebarOpen ? 1 : 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="h-full bg-[#0a0a0a] border-r border-white/5 flex flex-col relative z-50 overflow-hidden"
    >
      {/* Tabs Header */}
      <div className="flex p-2 bg-[#111111] border-b border-white/5 items-center">
        <div className="flex-1 flex gap-1">
          {(['nodes', 'workflows', 'chats', 'assets'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all ${activeTab === tab
                ? 'bg-black text-[#0097A7] shadow-xl border border-white/5'
                : 'text-gray-600 hover:text-gray-400'
                }`}
            >
              {tab === 'nodes' && <Box className="w-4 h-4" />}
              {tab === 'workflows' && <Layout className="w-4 h-4" />}
              {tab === 'chats' && <MessageSquare className="w-4 h-4" />}
              {tab === 'assets' && <ImageIcon className="w-4 h-4" />}
              <span className="text-[8px] font-black uppercase tracking-widest">{tab}</span>
            </button>
          ))}
        </div>
        <button
          onClick={toggleSidebar}
          className="p-2 ml-1 text-gray-600 hover:text-white transition-colors rounded-lg hover:bg-white/5"
          title="Close Sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'nodes' && <NodesTab key="nodes" />}
          {activeTab === 'workflows' && <WorkflowsTab key="workflows" />}
          {activeTab === 'chats' && <ChatsTab key="chats" />}
          {activeTab === 'assets' && (
            <motion.div
              key="assets"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <AssetGrid onAssetClick={setSelectedAsset} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Asset Preview Modal */}
      <AnimatePresence>
        {selectedAsset && (
          <AssetPreviewModal
            asset={selectedAsset}
            onClose={() => setSelectedAsset(null)}
            onDelete={() => {}}
            onToggleFavorite={() => {}}
          />
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="p-4 border-t border-white/5 bg-[#0d0d0d] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#0097A7]" />
          <span className="text-[8px] font-black text-white uppercase tracking-[0.3em]">Project Active</span>
        </div>
        <span className="text-[8px] font-bold text-gray-700 uppercase tracking-widest">v1.0.4</span>
      </div>
    </motion.div>
  );
}
