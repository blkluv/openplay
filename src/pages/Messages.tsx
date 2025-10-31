import { useSeoMeta } from '@unhead/react';
import { DMMessagingInterface } from '@/components/dm/DMMessagingInterface';
import { VideoLayout } from '@/components/video/VideoLayout';

const Messages = () => {
  useSeoMeta({
    title: 'Messages',
    description: 'Private encrypted messaging on Nostr',
  });

  return (
    <VideoLayout>
      <div className="container mx-auto px-3 sm:px-4 pt-4 pb-2 sm:pt-5 sm:pb-3 h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
        <DMMessagingInterface className="flex-1 min-h-0" />
      </div>
    </VideoLayout>
  );
};

export default Messages;
