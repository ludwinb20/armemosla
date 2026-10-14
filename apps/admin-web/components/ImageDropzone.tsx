'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { isImageFile } from '@/lib/storage';

interface ImageDropzoneProps {
  label?: string;
  hint?: string;
  imageUrl?: string | null;
  aspect?: 'square' | 'wide' | 'logo';
  onFile: (file: File) => void;
  onClear?: () => void;
  disabled?: boolean;
  emptyLabel?: string;
  compact?: boolean;
}

export function ImageDropzone({
  label,
  hint,
  imageUrl,
  aspect = 'wide',
  onFile,
  onClear,
  disabled,
  emptyLabel = 'Arrastrá una imagen o hacé clic',
  compact = false,
}: ImageDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const pickFile = useCallback(
    (file: File | undefined) => {
      if (!file || disabled) return;
      if (!isImageFile(file)) {
        setError('Solo se permiten imágenes');
        return;
      }
      setError('');
      onFile(file);
    },
    [disabled, onFile]
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="stack" style={{ gap: '0.4rem' }}>
      {label ? <span className="field-label">{label}</span> : null}
      <div
        className={`image-dropzone image-dropzone--${aspect}${compact ? ' image-dropzone--compact' : ''}${dragOver ? ' is-dragover' : ''}${imageUrl ? ' has-image' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="image-dropzone-input"
          disabled={disabled}
          onChange={(e) => {
            pickFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="image-dropzone-preview" />
            <div className="image-dropzone-overlay">
              <span>Cambiar imagen</span>
            </div>
          </>
        ) : (
          <div className="image-dropzone-empty">
            <span className="image-dropzone-icon">+</span>
            <span>{emptyLabel}</span>
          </div>
        )}
      </div>

      {imageUrl && onClear ? (
        <button
          type="button"
          className="btn btn-outline"
          style={{ width: 'fit-content', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
        >
          Quitar
        </button>
      ) : null}

      {hint ? <span className="muted" style={{ fontSize: '0.8rem' }}>{hint}</span> : null}
      {error ? <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{error}</span> : null}
    </div>
  );
}

interface PhotoGridProps {
  label?: string;
  items: { key: string; url: string }[];
  pending: { key: string; url: string; file: File }[];
  onAdd: (file: File) => void;
  onRemoveExisting: (key: string) => void;
  onRemovePending: (key: string) => void;
  disabled?: boolean;
}

export function PhotoGrid({
  label,
  items,
  pending,
  onAdd,
  onRemoveExisting,
  onRemovePending,
  disabled,
}: PhotoGridProps) {
  return (
    <div className="stack" style={{ gap: '0.5rem' }}>
      {label ? <span className="field-label">{label}</span> : null}
      <div className="photo-grid">
        {items.map((item) => (
          <div key={item.key} className="photo-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt="" />
            <button
              type="button"
              className="photo-card-remove"
              disabled={disabled}
              aria-label="Quitar foto"
              onClick={() => onRemoveExisting(item.key)}
            >
              ×
            </button>
          </div>
        ))}
        {pending.map((item) => (
          <div key={item.key} className="photo-card photo-card--pending">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt="" />
            <button
              type="button"
              className="photo-card-remove"
              disabled={disabled}
              aria-label="Quitar foto"
              onClick={() => onRemovePending(item.key)}
            >
              ×
            </button>
          </div>
        ))}
        <ImageDropzone
          aspect="square"
          compact
          emptyLabel="Agregar"
          disabled={disabled}
          onFile={onAdd}
        />
      </div>
    </div>
  );
}
