'use client';

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import {
  Loader2,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface ContactPhotoCropperProps {
  file: File;
  onCancel: () => void;
  onApply: (dataUrl: string) => void;
}

interface Position {
  x: number;
  y: number;
}

interface ImageSize {
  width: number;
  height: number;
}

interface DragState {
  pointerId: number;
  clientX: number;
  clientY: number;
  position: Position;
}

const OUTPUT_SIZE = 256;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function constrainPosition(
  position: Position,
  size: ImageSize,
  zoom: number,
): Position {
  const base = Math.min(size.width, size.height);

  const limitX = Math.max(
    0,
    (size.width / base * zoom - 1) / 2,
  );

  const limitY = Math.max(
    0,
    (size.height / base * zoom - 1) / 2,
  );

  return {
    x: clamp(position.x, -limitX, limitX),
    y: clamp(position.y, -limitY, limitY),
  };
}

export default function ContactPhotoCropper({
  file,
  onCancel,
  onApply,
}: ContactPhotoCropperProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const [sourceUrl, setSourceUrl] = useState('');
  const [size, setSize] = useState<ImageSize | null>(null);
  const [position, setPosition] = useState<Position>({
    x: 0,
    y: 0,
  });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSourceUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    dialog.showModal();

    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const changeZoom = (value: number) => {
    const nextZoom = clamp(value, MIN_ZOOM, MAX_ZOOM);

    setZoom(nextZoom);

    if (size) {
      setPosition((current) =>
        constrainPosition(current, size, nextZoom),
      );
    }
  };

  const resetCrop = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setError(null);
  };

  const handlePointerDown = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (!size || saving || dragRef.current) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);

    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      position,
    };

    setDragging(true);
  };

  const handlePointerMove = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    const drag = dragRef.current;

    if (
      !drag ||
      !size ||
      drag.pointerId !== event.pointerId
    ) {
      return;
    }

    const width = event.currentTarget.getBoundingClientRect().width;
    if (!width) return;

    setPosition(
      constrainPosition(
        {
          x:
            drag.position.x +
            (event.clientX - drag.clientX) / width,
          y:
            drag.position.y +
            (event.clientY - drag.clientY) / width,
        },
        size,
        zoom,
      ),
    );
  };

  const handlePointerEnd = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }

    dragRef.current = null;
    setDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyboardMove = (
    event: KeyboardEvent<HTMLDivElement>,
  ) => {
    if (!size || saving) return;

    const step = event.shiftKey ? 0.05 : 0.01;

    const changes: Record<string, Position> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };

    const change = changes[event.key];
    if (!change) return;

    event.preventDefault();

    setPosition((current) =>
      constrainPosition(
        {
          x: current.x + change.x,
          y: current.y + change.y,
        },
        size,
        zoom,
      ),
    );
  };

  const applyCrop = () => {
    const image = imageRef.current;

    if (!image || !size || saving) return;

    setSaving(true);
    setError(null);

    try {
      const cropSide =
        Math.min(size.width, size.height) / zoom;

      const safePosition = constrainPosition(
        position,
        size,
        zoom,
      );

      const sourceX = clamp(
        (size.width - cropSide) / 2 -
          safePosition.x * cropSide,
        0,
        size.width - cropSide,
      );

      const sourceY = clamp(
        (size.height - cropSide) / 2 -
          safePosition.y * cropSide,
        0,
        size.height - cropSide,
      );

      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;

      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error(
          'Image cropping is not supported in this browser.',
        );
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';

      context.drawImage(
        image,
        sourceX,
        sourceY,
        cropSide,
        cropSide,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
      );

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      setSaving(false);
      onApply(dataUrl);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not crop this photo. Please try another image.',
      );
      setSaving(false);
    }
  };

  const base = size
    ? Math.min(size.width, size.height)
    : 1;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="contact-crop-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onCancel();
      }}
      onClick={(event) => event.stopPropagation()}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-[28px] border border-border/80 bg-card p-5 text-foreground shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm sm:p-6"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2
            id="contact-crop-title"
            className="text-lg font-semibold text-slate-900 dark:text-white"
          >
            Adjust contact photo
          </h2>

          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Drag to reposition and use the slider to zoom.
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          aria-label="Cancel photo cropping"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-900">
        <div
          tabIndex={0}
          role="group"
          aria-label="Crop preview. Drag the photo or use the arrow keys to reposition it."
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onLostPointerCapture={() => {
            dragRef.current = null;
            setDragging(false);
          }}
          onKeyDown={handleKeyboardMove}
          className={`relative mx-auto aspect-square w-full max-w-[280px] touch-none select-none overflow-hidden rounded-full bg-slate-200 ring-2 ring-white focus-visible:outline-none focus-visible:ring-blue-500 dark:bg-slate-800 dark:ring-slate-600 ${
            dragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          {sourceUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imageRef}
              src={sourceUrl}
              alt="Contact photo crop preview"
              draggable={false}
              onLoad={(event) => {
                const image = event.currentTarget;

                if (!image.naturalWidth || !image.naturalHeight) {
                  setError('Could not read this image.');
                  return;
                }

                setSize({
                  width: image.naturalWidth,
                  height: image.naturalHeight,
                });

                setError(null);
              }}
              onError={() => {
                setSize(null);
                setError(
                  'This image could not be opened. Try a JPEG, PNG, or WebP photo.',
                );
              }}
              style={{
                position: 'absolute',
                left: `${50 + position.x * 100}%`,
                top: `${50 + position.y * 100}%`,
                width: size
                  ? `${size.width / base * zoom * 100}%`
                  : '100%',
                height: size
                  ? `${size.height / base * zoom * 100}%`
                  : '100%',
                maxWidth: 'none',
                transform: 'translate(-50%, -50%)',
                opacity: size ? 1 : 0,
                pointerEvents: 'none',
              }}
            />
          )}

          {!size && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <label htmlFor="contact-photo-zoom" className="font-medium">
            Zoom
          </label>
          <span className="text-slate-500">
            {zoom.toFixed(1)}×
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Zoom out"
            disabled={!size || saving || zoom <= MIN_ZOOM}
            onClick={() => changeZoom(zoom - 0.1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/80 transition hover:bg-accent disabled:opacity-40"
          >
            <ZoomOut className="h-4 w-4" />
          </button>

          <input
            id="contact-photo-zoom"
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={!size || saving}
            onChange={(event) =>
              changeZoom(Number(event.target.value))
            }
            className="min-w-0 flex-1 accent-blue-600"
          />

          <button
            type="button"
            aria-label="Zoom in"
            disabled={!size || saving || zoom >= MAX_ZOOM}
            onClick={() => changeZoom(zoom + 0.1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/80 transition hover:bg-accent disabled:opacity-40"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={resetCrop}
        disabled={!size || saving}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset position and zoom
      </button>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        The circle shows how the contact avatar will appear.
        Use Photo applies the crop. Save in Edit Contact saves your changes.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 rounded-2xl border border-border/80 px-4 py-2.5 text-sm font-semibold transition hover:bg-accent disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={applyCrop}
          disabled={!size || saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {saving && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          {saving ? 'Processing…' : 'Use Photo'}
        </button>
      </div>
    </dialog>
  );
}