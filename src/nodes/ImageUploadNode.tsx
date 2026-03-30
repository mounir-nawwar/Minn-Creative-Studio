import React, { useState, useRef } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { Upload, X, ImageIcon, Loader2, Library } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AssetGrid from '../components/AssetGrid';
import { API_BASE } from '../constants';

const ImageUploadNode = ({ id, data }: any) => {
  const [imageUrl, setImageUrl] = useState<string | null>(data.output || null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'assets'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { currentProject } = useProjectStore();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentProject) return;

    setIsUploading(true);
    updateNodeData(id, { isRunning: true });
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', currentProject.id);

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Upload failed');
      }
      
      const { url } = await response.json();

      // Store the Firebase Storage URL — short string, safe to save in Firestore
      setImageUrl(url);
      updateNodeData(id, { 
        output: url, 
        isRunning: false, 
        config: { ...data.config, url } 
      });
      setIsUploading(false);
    } catch (err: any) {
      console.error('Upload error:', err);
      updateNodeData(id, { error: err.message, isRunning: false });
      setIsUploading(false);
    }
  };

  const handleAssetSelect = (asset: any) => {
    setImageUrl(asset.url);
    updateNodeData(id, { output: asset.url, isRunning: false });
  };

  const handleClear = () => {
    setImageUrl(null);
    updateNodeData(id, { output: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <BaseNode id={id} data={data} inputs={false}>
      <div className="space-y-3">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          className="hidden" 
        />
        
        {/* Tabs */}
        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'upload' ? 'bg-[#0097A7] text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Upload
          </button>
          <button
            onClick={() => setActiveTab('assets')}
            className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'assets' ? 'bg-[#0097A7] text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            From Assets
          </button>
        </div>

        <div className="h-[180px] bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl overflow-hidden relative group/image">
          {activeTab === 'upload' ? (
            <>
              {!imageUrl ? (
                <button
                  onClick={triggerUpload}
                  disabled={isUploading}
                  className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-[#0097A7] transition-all group"
                >
                  {isUploading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-[#0097A7]" />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Drop or Click to Upload</span>
                    </>
                  )}
                </button>
              ) : (
                <>
                  <img 
                    src={imageUrl} 
                    alt="Uploaded" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <button 
                    onClick={handleClear}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-lg text-white opacity-0 group-hover/image:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full overflow-hidden flex flex-col">
              <AssetGrid isPicker onAssetClick={handleAssetSelect} />
            </div>
          )}
        </div>

        {imageUrl && activeTab === 'upload' && (
          <button
            onClick={triggerUpload}
            className="w-full py-2 bg-[#1a1a1a] hover:bg-[#222222] border border-[#2a2a2a] rounded-lg text-[10px] font-bold text-gray-400 hover:text-white transition-all flex items-center justify-center gap-2"
          >
            <ImageIcon className="w-3 h-3" />
            REPLACE IMAGE
          </button>
        )}

        <p className="text-[9px] text-gray-600 text-center italic">
          {activeTab === 'upload' ? 'Supports JPG, PNG, WEBP' : 'Select an image from your project assets'}
        </p>
      </div>
    </BaseNode>
  );
};

export default ImageUploadNode;
