"use client";

import React, { useRef, useState } from "react";

interface MultiFileUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  error?: string;
  isRequired?: boolean;
}

export function MultiFileUpload({
  files,
  onFilesChange,
  error,
  isRequired = true,
}: MultiFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const addFiles = (newFiles: File[]) => {
    onFilesChange([...files, ...newFiles]);
  };

  const removeFile = (indexToRemove: number) => {
    onFilesChange(files.filter((_, index) => index !== indexToRemove));
  };

  const clearFiles = () => {
    onFilesChange([]);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const openFileSelector = () => {
    inputRef.current?.click();
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length > 0) {
      addFiles(selected);
    }
    event.target.value = "";
  };

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.type === "dragenter" || event.type === "dragover") {
      setIsDragActive(true);
    } else if (event.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);

    const droppedFiles = Array.from(event.dataTransfer.files ?? []);
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Upload Files {isRequired && "*"}
      </label>

      <div
        className={`rounded-lg border-2 border-dashed p-5 sm:p-6 transition-colors ${
          isDragActive
            ? "border-primary bg-primary/5"
            : error
            ? "border-red-400 bg-red-50"
            : "border-gray-300 bg-gray-50 hover:bg-gray-100"
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="text-center space-y-2">
          <p className="text-sm text-gray-700">
            Drag and drop files here, or{" "}
            <button
              type="button"
              onClick={openFileSelector}
              className="font-medium text-primary hover:text-primary/80"
            >
              browse files
            </button>
          </p>
          <p className="text-xs text-gray-500">
            Multiple files supported. All file types are accepted.
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="border border-gray-200 rounded-md p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              Selected files ({files.length})
            </p>
            <button
              type="button"
              onClick={clearFiles}
              className="text-xs text-red-600 hover:text-red-700 font-medium"
            >
              Clear all
            </button>
          </div>

          <ul className="max-h-48 overflow-auto space-y-2">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${file.lastModified}-${index}`}
                className="flex items-center justify-between gap-3 bg-gray-50 rounded px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="text-xs text-red-600 hover:text-red-700 font-medium whitespace-nowrap"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
