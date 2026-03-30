import React, { useRef, useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Video, Upload, X, Loader2 } from 'lucide-react';

import { useAssets } from '../hooks/useAssets';

const VideoUploadNode = ({ id, data }: any) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { uploadAsset } = useAssets();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    updateNodeData(id, { isRunning: true, error: null, progress: 0 });
    try {
      const asset = await uploadAsset(file, (p) => updateNodeData(id, { progress: p }));
      updateNodeData(id, { 
        output: asset.url, 
        isRunning: false,
        progress: 100,
        config: { ...data.config, fileName: file.name } 
      });
    } catch (error) {
      updateNodeData(id, { error: 'Failed to upload video file', isRunning: false, progress: 0 });
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
          <div className="relative group">
            <div className="rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#0a0a0a] aspect-video flex items-center justify-center">
              <video 
                src={data.output} 
                className="w-full h-full object-contain"
                controls
              />
            </div>
            <button
              onClick={clearVideo}
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
        )}

        <p className="text-[9px] text-gray-600 italic text-center">
          Connect this to Video Describer or Video Upscaler nodes.
        </p>
      </div>
    </BaseNode>
  );
};

export default VideoUploadNode;
