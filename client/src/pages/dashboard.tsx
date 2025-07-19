import { useState, useEffect } from "react";
import { Video, Eye, Settings, Clock } from "lucide-react";
import VideoUpload from "@/components/VideoUpload";
import PlaylistManager from "@/components/PlaylistManager";
import StreamStatus from "@/components/StreamStatus";
import StreamConfig from "@/components/StreamConfig";
import CurrentlyPlaying from "@/components/CurrentlyPlaying";
import SettingsPanel from "@/components/SettingsPanel";
import { useQuery } from "@tanstack/react-query";
import { StreamStatus as StreamStatusType } from "@shared/schema";

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());

  const { data: streamStatus } = useQuery<StreamStatusType>({
    queryKey: ["/api/stream-status"],
    refetchInterval: 5000,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'text-success';
      case 'offline': return 'text-gray-500';
      case 'starting': return 'text-warning';
      case 'paused': return 'text-warning';
      case 'error': return 'text-error';
      default: return 'text-gray-500';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'live': return 'bg-success';
      case 'offline': return 'bg-gray-400';
      case 'starting': return 'bg-warning';
      case 'paused': return 'bg-warning';
      case 'error': return 'bg-error';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Video className="h-8 w-8 text-primary" />
                <h1 className="text-xl font-semibold text-gray-900">Sa Plays Roblox Streamer</h1>
              </div>
              <div className="hidden md:flex items-center space-x-1">
                <div className="flex items-center space-x-1 bg-success/10 text-success px-2 py-1 rounded-full text-sm">
                  <div className={`w-2 h-2 rounded-full ${getStatusDot(streamStatus?.status || 'offline')}`}></div>
                  <span className={getStatusColor(streamStatus?.status || 'offline')}>
                    {streamStatus?.status === 'live' ? 'Live' : 
                     streamStatus?.status === 'starting' ? 'Starting' :
                     streamStatus?.status === 'paused' ? 'Paused' :
                     streamStatus?.status === 'error' ? 'Error' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600 flex items-center space-x-1">
                <Clock className="h-4 w-4" />
                <span>{formatTime(currentTime)}</span>
              </div>
              <SettingsPanel />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Video Upload and Playlist */}
          <div className="lg:col-span-2 space-y-6">
            <VideoUpload />
            <PlaylistManager />
          </div>

          {/* Right Column - Stream Controls */}
          <div className="space-y-6">
            <StreamStatus />
            <StreamConfig />
            <CurrentlyPlaying />
          </div>
        </div>
      </div>
    </div>
  );
}
