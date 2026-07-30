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
  const localBlobUrlRef = useRef<string | null>(null);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { currentProject } = useProjectStore();
  const { uploadAsset } = useAssets({ autoFetch: false });
  const { setExpandedAsset } = useAssetExpand();

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (localBlobUrlRef.current) {
        URL.revokeObjectURL(localBlobUrlRef.current);
        localBlobUrlRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleCancelUpload = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsUploading(false);
    updateNodeData(id, { isRunning: false, progress: 0 });
  };

  const nodeUploadEnabled = data.uploadEnabled ?? true;
  const prevUploadEnabled = useRef(nodeUploadEnabled);
  const toggleNodeUpload = (checked: boolean) => updateNodeData(id, { uploadEnabled: checked });
  
  const imageUrlRef = useRef(imageUrl);
  const isUploadingRef = useRef(isUploading);
  const currentProjectRef = useRef(currentProject);
  
  useEffect(() => { imageUrlRef.current = imageUrl; }, [imageUrl]);
  useEffect(() => { isUploadingRef.current = isUploading; }, [isUploading]);
  useEffect(() => { currentProjectRef.current = currentProject; }, [currentProject]);

  // When toggled from OFF → ON with an existing local blob, trigger the upload
  useEffect(() => {
    const wasOff = !prevUploadEnabled.current;
    prevUploadEnabled.current = nodeUploadEnabled;
    if (wasOff && nodeUploadEnabled && imageUrlRef.current?.startsWith('blob:') && !isUploadingRef.current && currentProjectRef.current) {
      (async () => {
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setIsUploading(true);
        updateNodeData(id, { isRunning: true, progress: 1 });
        try {
          const res = await fetch(imageUrlRef.current!);
          const blob = await res.blob();
          const ext = blob.type.split('/')[1] || 'png';
          const file = new File([blob], data.config?.fileName || `image.${ext}`, { type: blob.type });
          const asset = await uploadAsset(file, (progress) => {
            updateNodeData(id, { progress: Math.max(progress, 1) });
          }, controller.signal);
          setImageUrl(asset.url);
          updateNodeData(id, { output: asset.url, isRunning: false, progress: 100, config: { ...data.config, url: asset.url } });
          if (imageUrlRef.current?.startsWith('blob:')) {
            URL.revokeObjectURL(imageUrlRef.current);
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          updateNodeData(id, { error: `Upload failed: ${message}`, isRunning: false });
        } finally {
          setIsUploading(false);
        }
      })();
    }
  }, [nodeUploadEnabled, id, data.config, uploadAsset, updateNodeData]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentProject) return;

    // Cleanup previous blob URL if exists
    if (localBlobUrlRef.current) {
      URL.revokeObjectURL(localBlobUrlRef.current);
      localBlobUrlRef.current = null;
    }

    // 1. Instant Preview logic
    const localUrl = URL.createObjectURL(file);
    localBlobUrlRef.current = localUrl;
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
      
      if (process.env.NODE_ENV === 'development') {
        console.log('ImageUploadNode: Upload finished successfully:', asset.url);
      }
      
      // Update with permanent URL
      setImageUrl(asset.url);
      updateNodeData(id, { 
        output: asset.url, 
        isRunning: false, 
        progress: 100,
        config: { ...data.config, url: asset.url, fileName: file.name } 
      });
      setIsUploading(false);
      
      // Cleanup local URL after successful upload
      if (localBlobUrlRef.current === localUrl) {
        URL.revokeObjectURL(localUrl);
        localBlobUrlRef.current = null;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Upload error:', message);
      // Keep the local URL usable even if upload fails, but show error
      updateNodeData(id, { error: `Upload failed (Using local copy): ${message}`, isRunning: false });
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
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

        {/* Cloud upload toggle */}
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Cloud upload</span>
          <ToggleSwitch checked={nodeUploadEnabled} onChange={toggleNodeUpload} size="node" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-black/40 p-1 ring-1 ring-white/10">
          {(['upload', 'assets'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-md py-1.5 text-[11px] font-medium transition-[color,background-color] duration-150 ${
                activeTab === tab ? 'bg-[#0097A7] text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab === 'upload' ? 'Upload' : 'From assets'}
            </button>
          ))}
        </div>

        {activeTab === 'upload' ? (
          !imageUrl ? (
            <div className="h-[150px] overflow-hidden rounded-xl bg-black/30 ring-1 ring-dashed ring-white/15">
              <button
                onClick={triggerUpload}
                disabled={isUploading}
                className="flex h-full w-full flex-col items-center justify-center gap-2 text-gray-500 transition-colors hover:text-[#0097A7]"
              >
                {isUploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-[#0097A7]" />
                ) : (
                  <>
                    <Upload className="h-6 w-6" />
                    <span className="text-[11px] font-medium">Drop or click to upload</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <ExpandableAssetWrapper onClick={() => imageUrl && setExpandedAsset(imageUrl, 'image')} type="image" className="max-h-[300px]">
              <div className="group/image relative">
                <img src={imageUrl} alt="Uploaded" className="h-auto max-h-[300px] w-full object-contain" referrerPolicy="no-referrer" />
                <button
                  onClick={(e) => { e.stopPropagation(); handleClear(); }}
                  className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 transition-[opacity,background-color] duration-150 hover:bg-black/80 group-hover/image:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </ExpandableAssetWrapper>
          )
        ) : (
          <div className="flex h-[240px] flex-col overflow-hidden rounded-xl bg-black/30 ring-1 ring-white/10">
            <AssetGrid isPicker onAssetClick={handleAssetSelect} />
          </div>
        )}

        {activeTab === 'upload' && isUploading && (
          <button
            onClick={handleCancelUpload}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-red-500/10 text-[12px] font-medium text-red-400 ring-1 ring-red-500/25 transition-[transform,background-color] duration-150 hover:bg-red-500/15 active:scale-[0.98]"
          >
            <X className="h-3.5 w-3.5" />
            Cancel upload
          </button>
        )}

        {imageUrl && activeTab === 'upload' && !isUploading && (
          <button
            onClick={triggerUpload}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white/[0.04] text-[12px] font-medium text-gray-300 ring-1 ring-white/10 transition-[transform,color,background-color] duration-150 hover:bg-white/[0.07] hover:text-white active:scale-[0.98]"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Replace image
          </button>
        )}

        <p className="text-center text-[10px] text-gray-600">
          {activeTab === 'upload' ? 'Supports JPG, PNG, WEBP' : 'Select an image from your project assets'}
        </p>
      </div>
    </BaseNode>
  );
};

export default React.memo(ImageUploadNode);
