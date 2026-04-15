import React, { useState, useRef, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import AssetGrid from '../components/AssetGrid';
import { useAssets } from '../hooks/useAssets';
import ToggleSwitch from '../components/ToggleSwitch';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';

const ImageUploadNode = ({ id, data }: any) => {
  const [imageUrl, setImageUrl] = useState<string | null>(data.output || null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'assets'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { currentProject } = useProjectStore();
  const { uploadAsset } = useAssets();
  const { setExpandedAsset } = useAssetExpand();

  const handleCancelUpload = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsUploading(false);
    updateNodeData(id, { isRunning: false, progress: 0 });
  };

  const nodeUploadEnabled = data.uploadEnabled ?? true;
  const prevUploadEnabled = useRef(nodeUploadEnabled);
  const toggleNodeUpload = (checked: boolean) => updateNodeData(id, { uploadEnabled: checked });

  // When toggled from OFF → ON with an existing local blob, trigger the upload
  useEffect(() => {
    const wasOff = !prevUploadEnabled.current;
    prevUploadEnabled.current = nodeUploadEnabled;
    if (wasOff && nodeUploadEnabled && imageUrl?.startsWith('blob:') && !isUploading && currentProject) {
      (async () => {
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setIsUploading(true);
        updateNodeData(id, { isRunning: true, progress: 1 });
        try {
          const res = await fetch(imageUrl);
          const blob = await res.blob();
          const ext = blob.type.split('/')[1] || 'png';
          const file = new File([blob], data.config?.fileName || `image.${ext}`, { type: blob.type });
          const asset = await uploadAsset(file, (progress) => {
            updateNodeData(id, { progress: Math.max(progress, 1) });
          }, controller.signal);
          setImageUrl(asset.url);
          updateNodeData(id, { output: asset.url, isRunning: false, progress: 100, config: { ...data.config, url: asset.url } });
          URL.revokeObjectURL(imageUrl);
        } catch (err: any) {
          updateNodeData(id, { error: `Upload failed: ${err.message}`, isRunning: false });
        } finally {
          setIsUploading(false);
        }
      })();
    }
  }, [nodeUploadEnabled]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentProject) return;

    // 1. Instant Preview logic
    const localUrl = URL.createObjectURL(file);
    setImageUrl(localUrl);

    if (!nodeUploadEnabled) {
      // No upload — set output as local blob, no running state
      updateNodeData(id, { output: localUrl, isRunning: false, progress: 0, error: null,
        config: { ...data.config, url: localUrl, fileName: file.name } });
      return;
    }

    // Set as output immediately so it's usable by other nodes
    updateNodeData(id, {
      output: localUrl,
      isRunning: true,
      progress: 1,
      error: null,
      config: { ...data.config, url: localUrl, fileName: file.name }
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsUploading(true);

    try {
      // 2. Background Upload
      const asset = await uploadAsset(file, (progress) => {
        updateNodeData(id, { progress: Math.max(progress, 1) });
      }, controller.signal);
      
      console.log('ImageUploadNode: Upload finished successfully:', asset.url);
      
      // Update with permanent URL
      setImageUrl(asset.url);
      updateNodeData(id, { 
        output: asset.url, 
        isRunning: false, 
        progress: 100,
        config: { ...data.config, url: asset.url, fileName: file.name } 
      });
      setIsUploading(false);
      
      // Cleanup local URL
      URL.revokeObjectURL(localUrl);
      // Ensure state is updated to permanent URL after revocation to prevent race condition
      setImageUrl(asset.url);
    } catch (err: any) {
      console.error('Upload error:', err);
      // Keep the local URL usable even if upload fails, but show error
      updateNodeData(id, { error: `Upload failed (Using local copy): ${err.message}`, isRunning: false });
      setIsUploading(false);
    }
  };

  const handleAssetSelect = (asset: any) => {
    setImageUrl(asset.url);
    updateNodeData(id, { output: asset.url, isRunning: false });
    setActiveTab('upload');
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
    <BaseNode id={id} data={data} inputs={false} color="#0097A7">
      <div className="space-y-3">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          className="hidden" 
        />
        
        {/* Cloud Upload Toggle */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-gray-600">Cloud Upload</span>
          <ToggleSwitch checked={nodeUploadEnabled} onChange={toggleNodeUpload} size="node" />
        </div>

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

        {activeTab === 'upload' ? (
          !imageUrl ? (
            <div className="h-[150px] bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl overflow-hidden">
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
            </div>
          ) : (
            <ExpandableAssetWrapper
              onClick={() => imageUrl && setExpandedAsset(imageUrl, 'image')}
              type="image"
              className="max-h-[300px]"
            >
              <div className="relative group/image">
                <img
                  src={imageUrl}
                  alt="Uploaded"
                  className="w-full h-auto max-h-[300px] object-contain"
                  referrerPolicy="no-referrer"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-lg text-white opacity-0 group-hover/image:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </ExpandableAssetWrapper>
          )
        ) : (
          <div className="h-[240px] bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl overflow-hidden flex flex-col">
            <AssetGrid isPicker onAssetClick={handleAssetSelect} />
          </div>
        )}

        {activeTab === 'upload' && isUploading && (
          <button
            onClick={handleCancelUpload}
            className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-[10px] font-bold text-red-400 hover:text-red-300 transition-all flex items-center justify-center gap-2"
          >
            <X className="w-3 h-3" />
            CANCEL UPLOAD
          </button>
        )}

        {imageUrl && activeTab === 'upload' && !isUploading && (
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
