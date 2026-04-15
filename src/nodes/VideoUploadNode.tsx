import React, { useRef, useState, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Video, Upload, X, Loader2 } from 'lucide-react';
import { useAssets } from '../hooks/useAssets';
import ToggleSwitch from '../components/ToggleSwitch';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';

const VideoUploadNode = ({ id, data }: any) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const updateNodeData = useStore((state) => state.updateNodeData);
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
    const currentOutput = data.output as string | undefined;
    if (wasOff && nodeUploadEnabled && currentOutput?.startsWith('blob:') && !isUploading) {
      (async () => {
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setIsUploading(true);
        updateNodeData(id, { isRunning: true, progress: 1 });
        try {
          const res = await fetch(currentOutput);
          const blob = await res.blob();
          const ext = blob.type.split('/')[1] || 'mp4';
          const file = new File([blob], data.config?.fileName || `video.${ext}`, { type: blob.type });
          const asset = await uploadAsset(file, (p) => updateNodeData(id, { progress: Math.max(p, 1) }), controller.signal);
          updateNodeData(id, { output: asset.url, isRunning: false, progress: 100, config: { ...data.config, fileName: data.config?.fileName } });
          setTimeout(() => URL.revokeObjectURL(currentOutput), 1000);
        } catch (err: any) {
          updateNodeData(id, { error: `Upload failed: ${err.message}`, isRunning: false });
        } finally {
          setIsUploading(false);
        }
      })();
    }
  }, [nodeUploadEnabled]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 1. Instant Preview logic
    const localUrl = URL.createObjectURL(file);

    if (!nodeUploadEnabled) {
      updateNodeData(id, { output: localUrl, isRunning: false, progress: 0, error: null,
        config: { ...data.config, fileName: file.name } });
      return;
    }

    updateNodeData(id, {
      output: localUrl,
      isRunning: true,
      error: null,
      progress: 1,
      config: { ...data.config, fileName: file.name }
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsUploading(true);

    try {
      // 2. Background Upload
      const asset = await uploadAsset(file, (p) => updateNodeData(id, { progress: Math.max(p, 1) }), controller.signal);
      
      // Update with permanent URL
      updateNodeData(id, { 
        output: asset.url, 
        isRunning: false,
        progress: 100,
        config: { ...data.config, fileName: file.name } 
      });
      
      // Cleanup local URL (delayed slightly to avoid flicker if video is playing or re-rendering)
      setTimeout(() => {
        URL.revokeObjectURL(localUrl);
        // Ensure store is updated to permanent URL after revocation to prevent race condition
        updateNodeData(id, { output: asset.url });
      }, 2000);
    } catch (error: any) {
      console.error('Video upload error:', error);
      // Keep local copy usable
      updateNodeData(id, { error: `Upload failed (Using local copy): ${error.message}`, isRunning: false });
    } finally {
      setIsUploading(false);
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const clearVideo = () => {
    updateNodeData(id, { output: null, config: { ...data.config, fileName: null } });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <BaseNode id={id} data={data} inputs={false} color="#0097A7" icon={Video}>
      <div className="space-y-3">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="video/*" 
          className="hidden" 
        />

        {!data.output ? (
          <button
            onClick={triggerUpload}
            disabled={isUploading}
            className="w-full py-8 border-2 border-dashed border-[#2a2a2a] rounded-xl flex flex-col items-center justify-center gap-2 hover:border-[#0097A7] hover:bg-[#0097A7]/5 transition-all group"
          >
            {isUploading ? (
              <Loader2 className="w-8 h-8 text-[#0097A7] animate-spin" />
            ) : (
              <Upload className="w-8 h-8 text-gray-600 group-hover:text-[#0097A7] transition-colors" />
            )}
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 group-hover:text-gray-300">
                {isUploading ? 'Reading Video...' : 'Upload Video'}
              </p>
              <p className="text-[8px] text-gray-600 mt-1 uppercase">Max 20MB</p>
            </div>
          </button>
        ) : (
          <ExpandableAssetWrapper
            onClick={() => data.output && setExpandedAsset(data.output, 'video')}
            type="video"
          >
            <div className="relative group">
              <div className="rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#0a0a0a] aspect-video flex items-center justify-center">
                <video 
                  src={data.output} 
                  className="w-full h-full object-contain"
                  controls
                />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearVideo();
                }}
                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              >
                <X className="w-3 h-3" />
              </button>
              {data.config?.fileName && (
                <p className="text-[9px] text-gray-500 mt-1 truncate px-1">
                  {data.config.fileName}
                </p>
              )}
            </div>
          </ExpandableAssetWrapper>
        )}

        {isUploading && (
          <button
            onClick={handleCancelUpload}
            className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-[10px] font-bold text-red-400 hover:text-red-300 transition-all flex items-center justify-center gap-2"
          >
            <X className="w-3 h-3" />
            CANCEL UPLOAD
          </button>
        )}

        {/* Cloud Upload Toggle */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-gray-600">Cloud Upload</span>
          <ToggleSwitch checked={nodeUploadEnabled} onChange={toggleNodeUpload} size="node" />
        </div>

        <p className="text-[9px] text-gray-600 italic text-center">
          Connect this to Video Describer or Video Upscaler nodes.
        </p>
      </div>
    </BaseNode>
  );
};

export default VideoUploadNode;
