import { useId, useRef, useState } from 'react';
import { Image as ImageIcon, Link2, Loader2, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/admin';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_EXT = /\.(jpg|jpeg|png|gif|webp)$/i;
const MAX_SIZE_BYTES = 8 * 1024 * 1024;

interface AdminImageUploadFieldProps {
  value: string;
  onChange: (nextUrl: string) => void;
  label?: string;
  previewAlt?: string;
  compact?: boolean;
}

export function AdminImageUploadField({
  value,
  onChange,
  label = '圖片',
  previewAlt = '圖片預覽',
  compact = false,
}: AdminImageUploadFieldProps) {
  const fileInputId = useId();
  const urlInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  const processUpload = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXT.test(file.name)) {
      toast.error('不支援的圖片格式', { description: '請選擇 JPG、PNG、GIF 或 WebP 圖片。' });
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('圖片檔案過大', { description: '單張圖片大小上限為 8MB。' });
      return;
    }

    setUploading(true);
    try {
      const res = await adminApi.uploadImage(file);
      let uploadedUrl = res.url;
      if (uploadedUrl.includes('cloudinary.com')) {
        uploadedUrl = uploadedUrl.replace('/upload/', '/upload/q_auto,f_auto/');
      }
      onChange(uploadedUrl);
      setShowUrlInput(false);
      toast.success('圖片已上傳至 Cloudinary！');
    } catch (err: unknown) {
      toast.error('圖片上傳失敗', {
        description: err instanceof Error ? err.message : '請稍後再試或改貼圖片連結',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processUpload(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void processUpload(file);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={fileInputId} className="arena-label text-muted-foreground mb-0">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowUrlInput((prev) => !prev)}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-sapphire-blue dark:text-blue-300 hover:underline"
        >
          <Link2 size={11} aria-hidden="true" />
          <span>{showUrlInput ? '隱藏網址輸入' : '改貼圖片網址'}</span>
        </button>
      </div>

      <input
        id={fileInputId}
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {value ? (
        <div className="rounded-xl overflow-hidden border border-border bg-surface-subtle/80 relative p-2.5 space-y-2">
          <div className="relative flex items-center justify-center min-h-[112px] rounded-lg bg-card/80 overflow-hidden">
            <img
              src={value}
              alt={previewAlt}
              className="max-h-32 w-auto object-contain"
            />
            <button
              type="button"
              aria-label="移除圖片"
              onClick={() => onChange('')}
              className="absolute top-1.5 right-1.5 size-7 flex items-center justify-center bg-slate-900/75 hover:bg-slate-900 text-white rounded-lg transition-colors"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-9 rounded-xl bg-card border-border text-xs font-bold text-foreground hover:bg-secondary gap-1.5"
          >
            {uploading ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <UploadCloud size={14} aria-hidden="true" />
            )}
            <span>{uploading ? '重新上傳中...' : '更換圖片（支援拖曳或選檔）'}</span>
          </Button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={cn(
            'rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 select-none',
            compact ? 'px-3 py-3' : 'px-4 py-5',
            dragging
              ? 'border-sapphire-blue bg-sapphire-blue/10'
              : 'border-border/80 bg-surface-subtle/60 hover:bg-secondary/70 hover:border-sapphire-blue/50',
            uploading && 'opacity-70 pointer-events-none',
          )}
        >
          <div className="size-9 rounded-xl bg-card border border-border/80 flex items-center justify-center text-sapphire-blue dark:text-blue-300 shadow-2xs">
            {uploading ? (
              <Loader2 size={17} className="animate-spin" aria-hidden="true" />
            ) : (
              <ImageIcon size={17} aria-hidden="true" />
            )}
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-black text-foreground">
              {uploading ? '圖片上傳中...' : '點擊選擇或拖曳圖片至此處上傳'}
            </p>
            <p className="text-[11px] font-bold text-muted-foreground">
              支援 JPG / PNG / GIF / WebP，最大 8MB
            </p>
          </div>
        </div>
      )}

      {showUrlInput && (
        <input
          id={urlInputId}
          type="url"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="或直接貼上外部圖片網址 https://..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="arena-input text-xs"
        />
      )}
    </div>
  );
}
