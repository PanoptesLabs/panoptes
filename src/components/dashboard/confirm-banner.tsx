import { Button } from "@/components/ui/button";

interface ConfirmBannerProps {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmBanner({ message, onCancel, onConfirm }: ConfirmBannerProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-DEFAULT/30 bg-amber-DEFAULT/5 px-4 py-3">
      <p className="text-xs text-amber-DEFAULT">{message}</p>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-6 px-2 text-[10px] text-dusty-lavender/70 hover:text-mist"
        >
          Cancel
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onConfirm}
          className="h-6 px-2 text-[10px] text-rose-DEFAULT hover:bg-rose-DEFAULT/10"
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}
