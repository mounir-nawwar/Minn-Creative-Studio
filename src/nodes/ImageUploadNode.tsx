import React, { useState, useRef } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';

const ImageUploadNode = ({ id, data }: any) => {
  const [imageUrl, setImageUrl] = useState<string | null>(data.output || null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImageUrl(result);
      updateNodeData(id, { output: result, isRunning: false });
      setIsUploading(false);
    };
    reader.onerror = () => {
      updateNodeData(id, { error: "Failed to read file", isRunning: false });
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
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
        
        {!imageUrl ? (
          <button
            onClick={triggerUpload}
            disabled={isUploading}
            className="w-full aspect-video bg-[#0a0a0a] border-2 border-dashed border-[#2a2a2a] hover:border-[#0097A7] rounded-xl flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-[#0097A7] transition-all group"
          >
            {isUploading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Upload className="w-6 h-6 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Upload Image</span>
              </>
            )}
          </button>
        ) : (
          <div className="relative group/image">
            <div className="aspect-video bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-lg">
              <img 
                src={imageUrl} 
                alt="Uploaded" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <button 
              onClick={handleClear}
              className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-lg text-white opacity-0 group-hover/image:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-[8px] text-gray-400 font-bold uppercase tracking-widest">
              Uploaded Image
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={triggerUpload}
            className="flex-1 py-2 bg-[#1a1a1a] hover:bg-[#222222] border border-[#2a2a2a] rounded-lg text-[10px] font-bold text-gray-400 hover:text-white transition-all flex items-center justify-center gap-2"
          >
            <ImageIcon className="w-3 h-3" />
            {imageUrl ? 'REPLACE' : 'BROWSE'}
          </button>
        </div>

        <p className="text-[9px] text-gray-600 text-center italic">
          Upload a local image to use as input for other nodes.
        </p>
      </div>
    </BaseNode>
  );
};

export default ImageUploadNode;
