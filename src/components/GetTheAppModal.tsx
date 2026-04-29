import { Smartphone, Apple, Download, X } from "lucide-react";
import { useAppSettings } from "@/hooks/useAppSettings";

interface Props { open: boolean; onClose: () => void; }

const GetTheAppModal = ({ open, onClose }: Props) => {
  const { data: settings } = useAppSettings();
  if (!open) return null;
  const links = settings?.mobile_app_links || {};
  const android = links.android || "";
  const ios = links.ios || "";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Download size={20} className="text-primary" />
            <h2 className="text-lg font-bold">Mobile App Required</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary"><X size={18} /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Offline downloads are only available in the mobile app. Install the app to save movies and TV shows for offline viewing.
        </p>
        <div className="space-y-2">
          {android ? (
            <a href={android} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground">
              <Smartphone size={16} /> Download for Android
            </a>
          ) : (
            <button disabled className="flex items-center justify-center gap-2 w-full rounded-xl bg-secondary py-3 text-sm font-bold text-muted-foreground">
              <Smartphone size={16} /> Android (link not set)
            </button>
          )}
          {ios ? (
            <a href={ios} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full rounded-xl bg-secondary py-3 text-sm font-bold">
              <Apple size={16} /> Download for iOS
            </a>
          ) : (
            <button disabled className="flex items-center justify-center gap-2 w-full rounded-xl bg-secondary/50 py-3 text-sm font-bold text-muted-foreground">
              <Apple size={16} /> iOS (link not set)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GetTheAppModal;
