import React, { useEffect, useState } from 'react';
import { Eraser, Loader2, RotateCw, Upload, X } from 'lucide-react';
import {
  processImageToDataUrl,
  readFileAsDataUrl,
  stripImageBackground,
  uploadCoverImageAsset,
  validateImageFile,
} from '../../utils/imageTools';
import type { CoverImageCrop } from '../../types/coverPage';

interface ImageCropperModalProps {
  title: string;
  userId: string;
  assetKey: string;
  initialSrc?: string;
  initialCrop?: CoverImageCrop;
  allowShape?: boolean;
  onClose: () => void;
  onSave: (finalUrl: string, crop: CoverImageCrop) => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  title,
  userId,
  assetKey,
  initialSrc = '',
  initialCrop,
  allowShape = true,
  onClose,
  onSave,
}) => {
  const [rawSrc, setRawSrc] = useState(initialSrc);
  const [previewSrc, setPreviewSrc] = useState(initialSrc);
  const [zoom, setZoom] = useState(initialCrop?.zoom || 1);
  const [offsetX, setOffsetX] = useState(initialCrop?.offsetX || 0);
  const [offsetY, setOffsetY] = useState(initialCrop?.offsetY || 0);
  const [rotation, setRotation] = useState(0);
  const [shape, setShape] = useState<'circle' | 'square' | 'rounded'>(
    initialCrop?.shape || 'circle'
  );
  const [bgRemoved, setBgRemoved] = useState(Boolean(initialCrop?.backgroundRemoved));
  const [bgThreshold, setBgThreshold] = useState(42);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPreviewSrc(rawSrc);
  }, [rawSrc]);

  const handleFileChange = async (file?: File | null) => {
    if (!file) return;
    setError('');
    const err = validateImageFile(file);
    if (err) {
      setError(err);
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setRawSrc(dataUrl);
      setPreviewSrc(dataUrl);
      setBgRemoved(false);
      setRotation(0);
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
    } catch (e: any) {
      setError(e?.message || 'Could not load image file.');
    }
  };

  const handleToggleRemoveBg = async () => {
    if (!rawSrc) return;
    setBusy(true);
    setError('');
    try {
      if (!bgRemoved) {
        const stripped = await stripImageBackground(rawSrc, bgThreshold);
        setPreviewSrc(stripped);
        setBgRemoved(true);
      } else {
        setPreviewSrc(rawSrc);
        setBgRemoved(false);
      }
    } catch (e: any) {
      setError(e?.message || 'Background removal failed on this image.');
    } finally {
      setBusy(false);
    }
  };

  const handleThresholdChange = async (nextVal: number) => {
    setBgThreshold(nextVal);
    if (bgRemoved && rawSrc) {
      try {
        const stripped = await stripImageBackground(rawSrc, nextVal);
        setPreviewSrc(stripped);
      } catch {
        // ignore transient slider scrub errors
      }
    }
  };

  const handleApply = async () => {
    if (!previewSrc) {
      setError('Please upload an image first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const processed = await processImageToDataUrl(previewSrc, {
        maxDimension: 640,
        rotation,
        cropZoom: zoom,
        cropOffsetX: offsetX,
        cropOffsetY: offsetY,
        preserveTransparency: bgRemoved || previewSrc.startsWith('data:image/png'),
      });
      const finalUrl = await uploadCoverImageAsset(userId, assetKey, processed);
      onSave(finalUrl, {
        zoom: 1, // baked cleanly into processed asset
        offsetX: 0,
        offsetY: 0,
        shape,
        backgroundRemoved: bgRemoved,
      });
    } catch (e: any) {
      setError(e?.message || 'Failed processing image.');
    } finally {
      setBusy(false);
    }
  };

  const radiusClass =
    shape === 'circle' ? 'rounded-full' : shape === 'rounded' ? 'rounded-2xl' : 'rounded-xs';

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto studio-scroll">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#142B4A]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* File Dropzone / Picker */}
        <label className="block border-2 border-dashed border-slate-300 hover:border-[#2864A6] rounded-xl p-4 text-center cursor-pointer bg-slate-50/70 transition-colors">
          <Upload className="w-5 h-5 text-[#2864A6] mx-auto mb-1" />
          <div className="text-xs font-semibold text-[#142B4A]">
            Choose JPG, JPEG, PNG, or WebP image
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Automatic compression & optional transparent background cutout
          </div>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={(e) => handleFileChange(e.target.files?.[0])}
            className="hidden"
          />
        </label>

        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Live Crop Preview */}
        {previewSrc && (
          <div className="space-y-4">
            <div className="flex justify-center p-4 bg-slate-100 rounded-xl border border-slate-200">
              <div
                className={`w-44 h-44 overflow-hidden border-2 border-[#142B4A] bg-white flex items-center justify-center ${radiusClass}`}
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                }}
              >
                <img
                  src={previewSrc}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  style={{
                    transform: `translate(${offsetX}%, ${offsetY}%) rotate(${rotation}deg) scale(${zoom})`,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex justify-between font-semibold text-slate-600 mb-1">
                  <span>Zoom</span>
                  <span className="tabular-nums">{zoom.toFixed(1)}×</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={2.6}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-[#142B4A]"
                />
              </div>
              <div>
                <div className="flex justify-between font-semibold text-slate-600 mb-1">
                  <span>Horizontal Shift</span>
                  <span className="tabular-nums">{offsetX}%</span>
                </div>
                <input
                  type="range"
                  min={-40}
                  max={40}
                  step={2}
                  value={offsetX}
                  onChange={(e) => setOffsetX(Number(e.target.value))}
                  className="w-full accent-[#142B4A]"
                />
              </div>
              <div>
                <div className="flex justify-between font-semibold text-slate-600 mb-1">
                  <span>Vertical Shift</span>
                  <span className="tabular-nums">{offsetY}%</span>
                </div>
                <input
                  type="range"
                  min={-40}
                  max={40}
                  step={2}
                  value={offsetY}
                  onChange={(e) => setOffsetY(Number(e.target.value))}
                  className="w-full accent-[#142B4A]"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg inline-flex items-center justify-center gap-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Rotate 90° ({rotation}°)</span>
                </button>
              </div>
            </div>

            {allowShape && (
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1.5">Frame Shape</div>
                <div className="grid grid-cols-3 gap-2">
                  {(['circle', 'rounded', 'square'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setShape(s)}
                      className={`py-1.5 text-xs font-semibold rounded-lg border capitalize ${
                        shape === s
                          ? 'bg-[#142B4A] text-white border-[#142B4A]'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Background Removal Tool */}
            <div className="p-3 bg-[#EAF2FB]/60 border border-[#2864A6]/20 rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs">
                  <span className="font-bold text-[#142B4A] block">Background Removal</span>
                  <span className="text-[11px] text-slate-600">
                    Strip uniform white/solid backdrop for clean cutout
                  </span>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleToggleRemoveBg}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 shrink-0 ${
                    bgRemoved
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border border-slate-300 text-[#142B4A] hover:bg-slate-50'
                  }`}
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>{bgRemoved ? 'Restore Original' : 'Remove Background'}</span>
                </button>
              </div>
              {bgRemoved && (
                <div>
                  <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                    <span>Edge Sensitivity</span>
                    <span className="tabular-nums">{bgThreshold}</span>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={85}
                    value={bgThreshold}
                    onChange={(e) => handleThresholdChange(Number(e.target.value))}
                    className="w-full accent-[#142B4A]"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !previewSrc}
            onClick={handleApply}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#142B4A] hover:bg-[#1e3d66] disabled:opacity-50 rounded-lg inline-flex items-center gap-1.5"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Apply Image</span>
          </button>
        </div>
      </div>
    </div>
  );
};
