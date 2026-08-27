import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { Flag, Loader2 } from 'lucide-react';
import type { NostrEvent } from 'nostr-tools';

interface ReportDialogProps {
  videoEvent: NostrEvent;
  children?: React.ReactNode;
}

const reportReasons = [
  { value: 'nudity', label: 'Nudity or sexual content' },
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'illegal', label: 'Illegal activities' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'malware', label: 'Malware or phishing' },
  { value: 'other', label: 'Other' },
];

export function ReportDialog({ videoEvent, children }: ReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user: currentUser } = useCurrentUser();
  const { publishEvent } = useNostrPublish();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      toast({
        title: 'Authentication Required',
        description: 'You must be logged in to report content',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create a kind 1984 report event (NIP-56)
      await publishEvent({
        kind: 1984,
        content: details || `Report: ${reason}`,
        tags: [
          ['e', videoEvent.id],
          ['p', videoEvent.pubkey],
          ['report', reason],
        ],
      });

      toast({
        title: 'Report Submitted',
        description: 'Thank you for helping keep VID safe. Your report has been submitted.',
      });

      setOpen(false);
      setReason('spam');
      setDetails('');
    } catch (error) {
      console.error('Failed to submit report:', error);
      toast({
        title: 'Report Failed',
        description: 'Failed to submit your report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentUser) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm">
            <Flag className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Report Video</DialogTitle>
          <DialogDescription>
            Help us understand what's wrong with this video. Your report will be reviewed by moderators.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Label>Reason for reporting</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {reportReasons.map((r) => (
                <div key={r.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={r.value} id={r.value} />
                  <Label htmlFor={r.value} className="font-normal cursor-pointer">
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">Additional details (optional)</Label>
            <Textarea
              id="details"
              placeholder="Provide more information about why you're reporting this video..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Report'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
