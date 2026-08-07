import React, { useState, useRef } from 'react';
import { Upload, FileText, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from './Button';

export interface FileDropzoneProps {
  accept?: string;
  maxSizeMB?: number;
  onFileSelect?: (file: File | null) => void;
  selectedFile?: File | null;
  error?: string | null;
  disabled?: boolean;
  className?: string;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  accept = '.csv',
  maxSizeMB = 25,
  onFileSelect,
  selectedFile: controlledFile,
  error: controlledError,
  disabled = false,
  className = '',
}) => {
  const [internalFile, setInternalFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const file = controlledFile !== undefined ? controlledFile : internalFile;
  const error = controlledError !== undefined ? controlledError : localError;

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selected = files[0];

    // Format validation check
    if (accept && !selected.name.toLowerCase().endsWith(accept.replace('*', '').toLowerCase())) {
      const err = `Invalid file format. Only ${accept.toUpperCase()} files are supported.`;
      setLocalError(err);
      onFileSelect?.(null);
      return;
    }

    // Size validation check
    if (selected.size > maxSizeMB * 1024 * 1024) {
      const err = `File size exceeds maximum limit of ${maxSizeMB}MB.`;
      setLocalError(err);
      onFileSelect?.(null);
      return;
    }

    setLocalError(null);
    setInternalFile(selected);
    onFileSelect?.(selected);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleRemove = () => {
    setInternalFile(null);
    setLocalError(null);
    if (inputRef.current) inputRef.current.value = '';
    onFileSelect?.(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className={`w-full space-y-3 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          className={`relative p-8 md:p-10 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer text-center flex flex-col items-center justify-center select-none ${
            isDragOver
              ? 'border-blue-600 bg-blue-50/60 shadow-md shadow-blue-900/5 scale-[1.005]'
              : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/80 shadow-xs'
          } ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
        >
          <div className="p-3.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600 mb-3 shadow-xs">
            <Upload className="w-6 h-6" />
          </div>

          <p className="text-sm font-semibold text-slate-900">
            Drag & drop candidate dataset CSV here
          </p>
          <p className="text-xs text-slate-500 mt-1">
            or <span className="text-blue-600 hover:underline font-medium">browse files</span> from your computer
          </p>

          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-50 border border-slate-200 text-[11px] font-mono-tabular text-slate-500">
            <span>Accepted format: <strong className="text-slate-800 font-semibold">{accept.toUpperCase()}</strong></span>
            <span>•</span>
            <span>Max size: <strong className="text-slate-800 font-semibold">{maxSizeMB}MB</strong></span>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="p-2.5 rounded-lg bg-white border border-blue-200 text-blue-600 shrink-0 shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 truncate">{file.name}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              </div>
              <div className="text-xs text-slate-500 font-mono-tabular mt-0.5">
                {formatFileSize(file.size)} • Ready for audit pipeline
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={handleRemove}
            disabled={disabled}
            aria-label="Remove file"
            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200 font-mono-tabular">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
