import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { JitsiCall } from "./JitsiCall";

interface VideoCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomName: string;
  displayName?: string;
  title?: string;
}

export function VideoCallDialog({ open, onOpenChange, roomName, displayName, title }: VideoCallDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 sm:p-0 gap-0 h-[80vh] overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="text-sm">{title ?? "Video call"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 h-full">
          {open && (
            <JitsiCall
              roomName={roomName}
              displayName={displayName}
              onClose={() => onOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
