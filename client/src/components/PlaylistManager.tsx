import { useState, useRef } from "react";
import { GripVertical, Play, Edit, Trash2, Plus, CheckCircle, Circle, Upload, Repeat, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Video, StreamStatus } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export default function PlaylistManager() {
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: videos = [], isLoading } = useQuery<Video[]>({
    queryKey: ['/api/videos'],
  });

  const { data: streamStatus } = useQuery<StreamStatus>({
    queryKey: ['/api/stream-status'],
    refetchInterval: 5000,
  });

  const toggleLoopMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const endpoint = enabled ? '/api/stream/loop/enable' : '/api/stream/loop/disable';
      await apiRequest('POST', endpoint);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stream-status'] });
      toast({
        title: "Success",
        description: streamStatus?.loopPlaylist ? "24x7 loop disabled" : "24x7 loop enabled",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to toggle loop",
        variant: "destructive",
      });
    },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/videos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/videos'] });
      toast({
        title: "Success",
        description: "Video deleted successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete video",
        variant: "destructive",
      });
    },
  });

  const uploadVideoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('title', file.name);
      formData.append('duration', '00:00');
      
      const response = await fetch('/api/videos', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/videos'] });
      toast({
        title: "Success",
        description: "Video uploaded successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload video",
        variant: "destructive",
      });
    },
  });

  const setCurrentVideoMutation = useMutation({
    mutationFn: async (videoId: number) => {
      await apiRequest('POST', '/api/stream/set-current', { videoId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stream-status'] });
      toast({
        title: "Success",
        description: "Video set as current!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set current video",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      // Validate file type
      const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/quicktime'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Error",
          description: "Invalid file type. Only MP4, AVI, and MOV files are allowed.",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (500MB limit)
      if (file.size > 500 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "File size too large. Maximum size is 500MB.",
          variant: "destructive",
        });
        return;
      }
      
      uploadVideoMutation.mutate(file);
    }
    
    // Reset input
    e.target.value = '';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getNextVideo = () => {
    if (!streamStatus?.currentVideoId || videos.length === 0) return null;
    
    const currentIndex = videos.findIndex(v => v.id === streamStatus.currentVideoId);
    if (currentIndex === -1) return null;
    
    const nextIndex = (currentIndex + 1) % videos.length;
    return videos[nextIndex];
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-material p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-300 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center space-x-4 p-4 bg-gray-100 rounded-lg">
                <div className="w-4 h-4 bg-gray-300 rounded"></div>
                <div className="w-16 h-12 bg-gray-300 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-material p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Playlist Management</h2>
          <div className="flex items-center space-x-4 mt-1">
            <span className="text-sm text-gray-500">{videos.length} videos</span>
            {streamStatus?.currentVideoId && (
              <div className="flex items-center space-x-2">
                <Circle className="h-3 w-3 text-primary" />
                <span className="text-sm text-gray-600">
                  Current: {videos.find(v => v.id === streamStatus.currentVideoId)?.title || 'Unknown'}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700">24x7 Loop</span>
            <Switch
              checked={streamStatus?.loopPlaylist || false}
              onCheckedChange={(checked) => toggleLoopMutation.mutate(checked)}
              disabled={toggleLoopMutation.isPending}
            />
          </div>
          <div className="flex items-center space-x-2">
            {streamStatus?.status === 'live' && (
              <Badge variant="destructive" className="text-xs">
                Live Stream
              </Badge>
            )}
            <Button 
              size="sm" 
              variant="outline" 
              title="Upload new video"
              onClick={handleFileUpload}
              disabled={uploadVideoMutation.isPending}
            >
              {uploadVideoMutation.isPending ? (
                <>
                  <Upload className="h-4 w-4 mr-1 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No videos in playlist. Upload some videos to get started!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((video) => {
            const isCurrentVideo = video.id === streamStatus?.currentVideoId;
            const nextVideo = getNextVideo();
            const isNextVideo = nextVideo?.id === video.id;
            
            return (
              <div
                key={video.id}
                className={`flex items-center space-x-4 p-4 rounded-lg hover:bg-gray-100 transition-colors ${
                  isCurrentVideo 
                    ? 'bg-blue-50 border-2 border-blue-200' 
                    : isNextVideo
                    ? 'bg-green-50 border-2 border-green-200'
                    : 'bg-gray-50 border-2 border-transparent'
                }`}
              >
                <div className="flex-shrink-0">
                  <GripVertical className="h-5 w-5 text-gray-400" />
                </div>
                
                <div className="flex-shrink-0 w-16 h-12 bg-gray-200 rounded flex items-center justify-center">
                  <Play className="h-4 w-4 text-gray-500" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    {isCurrentVideo && (
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                    )}
                    {isNextVideo && (
                      <div className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                        Next
                      </div>
                    )}
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {video.title}
                    </p>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>{video.duration}</span>
                    <span>{formatFileSize(video.fileSize)}</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewVideo(video)}
                    title="Preview video"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentVideoMutation.mutate(video.id)}
                    disabled={setCurrentVideoMutation.isPending}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteVideoMutation.mutate(video.id)}
                    disabled={deleteVideoMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="video/mp4,video/avi,video/mov,video/quicktime"
        style={{ display: 'none' }}
      />

      {/* Video Preview Dialog */}
      <Dialog open={!!previewVideo} onOpenChange={() => setPreviewVideo(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Video Preview</DialogTitle>
            <DialogDescription>
              Preview and test video playback
            </DialogDescription>
          </DialogHeader>
          {previewVideo && (
            <div className="space-y-4">
              <div className="bg-black rounded-lg overflow-hidden">
                <video
                  controls
                  className="w-full h-auto max-h-96"
                  preload="metadata"
                  src={`/uploads/${previewVideo.filename}`}
                  onError={(e) => {
                    console.error('Video playback error:', e);
                    toast({
                      title: "Playback Error",
                      description: "Unable to play this video file",
                      variant: "destructive",
                    });
                  }}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{previewVideo.title}</h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>Duration: {previewVideo.duration}</span>
                    <span>Size: {formatFileSize(previewVideo.fileSize)}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setPreviewVideo(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}