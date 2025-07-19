import { Play } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { Video, StreamStatus } from "@shared/schema";

export default function CurrentlyPlaying() {
  const { data: videos = [] } = useQuery<Video[]>({
    queryKey: ['/api/videos'],
  });

  const { data: streamStatus } = useQuery<StreamStatus>({
    queryKey: ['/api/stream-status'],
    refetchInterval: 5000,
  });

  const currentVideo = videos.find(v => v.id === streamStatus?.currentVideoId);
  const currentIndex = videos.findIndex(v => v.id === streamStatus?.currentVideoId);
  const nextVideo = currentIndex >= 0 && currentIndex < videos.length - 1 
    ? videos[currentIndex + 1] 
    : null;

  // Mock progress - in real implementation, this would come from the streaming service
  const progress = streamStatus?.status === 'live' ? 30 : 0;

  if (!currentVideo) {
    return (
      <div className="bg-white rounded-lg shadow-material p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Now Playing</h2>
        <div className="text-center py-8">
          <p className="text-gray-500">No video currently playing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-material p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Now Playing</h2>
      
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-16 h-12 bg-gray-300 rounded overflow-hidden flex-shrink-0">
            <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center">
              <Play className="h-3 w-3 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate">{currentVideo.title}</h3>
            <p className="text-xs text-gray-500">
              {/* Mock current time - in real implementation, this would be calculated */}
              {streamStatus?.status === 'live' ? '00:45' : '00:00'} / {currentVideo.duration}
            </p>
          </div>
        </div>
        
        <Progress value={progress} className="h-2" />
        
        <div className="text-center">
          <div className="text-sm text-gray-600">
            Next: {nextVideo ? (
              <span className="font-medium">{nextVideo.title}</span>
            ) : (
              <span className="font-medium">End of playlist</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
