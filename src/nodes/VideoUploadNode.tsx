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
            className="group flex w-full flex-col items-center justify-center gap-2 rounded-xl bg-black/30 py-8 ring-1 ring-dashed ring-white/15 transition-[color,box-shadow] duration-150 hover:ring-[#0097A7]/50"
          >
            {isUploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-[#0097A7]" />
            ) : (
              <Upload className="h-8 w-8 text-gray-600 transition-colors group-hover:text-[#0097A7]" />
            )}
            <div className="text-center">
              <p className="text-[12px] font-medium text-gray-400 group-hover:text-gray-200">{isUploading ? 'Reading video…' : 'Upload video'}</p>
              <p className="mt-0.5 text-[10px] text-gray-600">Max 20MB</p>
            </div>
          </button>
        ) : (
          <ExpandableAssetWrapper onClick={() => data.output && setExpandedAsset(data.output, 'video')} type="video">
            <div className="group relative">
              <div className="flex aspect-video items-center justify-center bg-black">
                <video src={data.output} className="h-full w-full object-contain" controls />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); clearVideo(); }}
                className="absolute -right-2 -top-2 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </ExpandableAssetWrapper>
        )}

        {data.config?.fileName && data.output && <p className="truncate px-1 text-[11px] text-gray-500">{data.config.fileName}</p>}

        {isUploading && (
          <button
            onClick={handleCancelUpload}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-red-500/10 text-[12px] font-medium text-red-400 ring-1 ring-red-500/25 transition-[transform,background-color] duration-150 hover:bg-red-500/15 active:scale-[0.98]"
          >
            <X className="h-3.5 w-3.5" />
            Cancel upload
          </button>
        )}

        <div className="flex items-center justify-between px-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Cloud upload</span>
          <ToggleSwitch checked={nodeUploadEnabled} onChange={toggleNodeUpload} size="node" />
        </div>

        <p className="text-center text-[10px] text-gray-600">Connect to Video Describer or Video Upscaler nodes.</p>
      </div>
    </BaseNode>
  );
};

export default React.memo(VideoUploadNode);
