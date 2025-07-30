"use client";

import React, { useState, useRef } from "react";

interface DocumentUploadProps {
  label: string;
  accept: string;
  description: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  error?: string;
}

export function DocumentUpload({
  label,
  accept,
  description,
  file,
  onFileChange,
  error,
}: DocumentUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (selectedFile: File): string | null => {
    // Check file type based on accept prop
    const allowedExtensions = accept.split(",").map((ext) => ext.trim());
    const fileExtension =
      "." + selectedFile.name.split(".").pop()?.toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      return `File must be ${accept} format`;
    }

    // Check file size (10MB max per file)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (selectedFile.size > maxSize) {
      return "File size must not exceed 10MB";
    }

    return null;
  };

  const handleFileChange = (selectedFile: File | null) => {
    if (!selectedFile) {
      onFileChange(null);
      return;
    }

    const validationError = validateFile(selectedFile);
    if (validationError) {
      onFileChange(null);
      return;
    }

    onFileChange(selectedFile);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileChange(e.target.files[0]);
    }
  };

  const openFileSelector = () => {
    inputRef.current?.click();
  };

  const removeFile = () => {
    handleFileChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label} *
      </label>

      <div
        className={`
          relative border-2 border-dashed rounded-lg p-4 sm:p-6 text-center
          transition-colors duration-200
          ${
            dragActive
              ? "border-primary-400 bg-primary-50"
              : file
              ? "border-green-400 bg-green-50"
              : error
              ? "border-red-400 bg-red-50"
              : "border-gray-300 bg-gray-50 hover:bg-gray-100"
          }
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        {file ? (
          <div className="space-y-3">
            <div className="text-green-600">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">
                {formatFileSize(file.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={removeFile}
              className="text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Remove File
            </button>
          </div>
        ) : (
          <div className="space-y-3">
                         <div className="text-gray-400 flex justify-center items-center">
               <svg
                 className="w-10 h-10 sm:w-12 sm:h-12"
                 viewBox="0 0 24 24"
                 fill="none"
                 xmlns="http://www.w3.org/2000/svg"
               >
                 <path
                   d="M12 6L12 8M12 8L12 10M12 8H9.99998M12 8L14 8"
                   stroke="#1C274C"
                   strokeWidth="1.5"
                   strokeLinecap="round"
                 />
                 <path
                   d="M8 14H9M16 14H12"
                   stroke="#1C274C"
                   strokeWidth="1.5"
                   strokeLinecap="round"
                 />
                 <path
                   d="M9 18H15"
                   stroke="#1C274C"
                   strokeWidth="1.5"
                   strokeLinecap="round"
                 />
                 <path
                   d="M3 14V10C3 6.22876 3 4.34315 4.17157 3.17157C5.34315 2 7.22876 2 11 2H13C16.7712 2 18.6569 2 19.8284 3.17157C20.4816 3.82476 20.7706 4.69989 20.8985 6M21 10V14C21 17.7712 21 19.6569 19.8284 20.8284C18.6569 22 16.7712 22 13 22H11C7.22876 22 5.34315 22 4.17157 20.8284C3.51839 20.1752 3.22937 19.3001 3.10149 18"
                   stroke="#1C274C"
                   strokeWidth="1.5"
                   strokeLinecap="round"
                 />
               </svg>
            </div>
            <div>
              <button
                type="button"
                onClick={openFileSelector}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Click to upload
              </button>
              <span className="text-gray-500"> or drag and drop</span>
            </div>
            <p className="text-xs text-gray-500">
              {accept.toUpperCase()} files only, max 10MB
            </p>
          </div>
        )}
      </div>

      {description && <p className="text-xs text-gray-600">{description}</p>}

      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
