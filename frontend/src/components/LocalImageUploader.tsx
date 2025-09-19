'use client';

import { useState, useRef } from 'react';

interface LocalImageUploaderProps {
  onUploadComplete: (imageUrl: string) => void;
  acceptedFileTypes?: string[];
  maxFileSize?: number;
  className?: string;
}

export function LocalImageUploader({
  onUploadComplete,
  acceptedFileTypes = ['image/*'],
  maxFileSize = 5 * 1024 * 1024, // 5MB
  className = ''
}: LocalImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.size > maxFileSize) {
      alert(`File size must be less than ${Math.round(maxFileSize / (1024 * 1024))}MB`);
      return;
    }

    setUploading(true);
    try {
      // Convert image to base64 data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        onUploadComplete(dataUrl);
        setUploading(false);
      };
      reader.onerror = () => {
        alert('Failed to read file');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFileTypes.join(',')}
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`
          cursor-pointer transition-all duration-200 text-center
          ${dragOver 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
          }
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {uploading ? (
          <div className="p-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-blue-600 font-medium">Processing cover image...</p>
          </div>
        ) : (
          <div className="p-8">
            <div className="text-4xl mb-4">📷</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {dragOver ? 'Drop your image here' : 'Upload Cover Image'}
            </h3>
            <p className="text-gray-600 mb-4">
              Drag and drop your book cover, or click to browse
            </p>
            <div className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Choose File
            </div>
            <p className="text-sm text-gray-500 mt-3">
              Supports PNG, JPG, WEBP up to {Math.round(maxFileSize / (1024 * 1024))}MB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}