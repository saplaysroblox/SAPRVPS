import { Square, Pause, Monitor, Signal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StreamStatus as StreamStatusType, StreamConfig } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function StreamStatus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: streamStatus } = useQuery<StreamStatusType>({
    queryKey: ['/api/stream-status'],
    refetchInterval: 5000,
  });

  const { data: streamConfig } = useQuery<StreamConfig>({
    queryKey: ['/api/stream-config'],
    refetchInterval: 10000,
  });

  const stopStreamMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/stream/stop');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stream-status'] });
      toast({
        title: "Success",
        description: "Stream stopped successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to stop stream",
        variant: "destructive",
      });
    },
  });

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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'live': return 'Live';
      case 'offline': return 'Offline';
      case 'starting': return 'Starting';
      case 'paused': return 'Paused';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-material p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Stream Status</h2>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Status</span>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${getStatusDot(streamStatus?.status || 'offline')}`}></div>
            <span className={`text-sm font-medium ${getStatusColor(streamStatus?.status || 'offline')}`}>
              {getStatusText(streamStatus?.status || 'offline')}
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Viewers</span>
          <span className="text-sm font-medium text-gray-900">
            {streamStatus?.viewerCount?.toLocaleString() || '0'}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Uptime</span>
          <span className="text-sm font-medium text-gray-900">
            {streamStatus?.uptime || '00:00:00'}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Video Bitrate</span>
          <span className="text-sm font-medium text-gray-900">
            {streamConfig?.bitrate ? `${streamConfig.bitrate} kbps` : 'Not configured'}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Resolution</span>
          <span className="text-sm font-medium text-gray-900">
            {streamConfig?.resolution || 'Not configured'}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Frame Rate</span>
          <span className="text-sm font-medium text-gray-900">
            {streamConfig?.framerate ? `${streamConfig.framerate} fps` : 'Not configured'}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Audio Quality</span>
          <span className="text-sm font-medium text-gray-900">
            {streamConfig?.audioQuality ? `${streamConfig.audioQuality} kbps` : 'Not configured'}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Platform</span>
          <span className="text-sm font-medium text-gray-900 capitalize">
            {streamConfig?.platform || 'Not configured'}
          </span>
        </div>
      </div>

      {/* Stream Controls */}
      <div className="mt-6 space-y-3">
        {(streamStatus?.status === 'live' || streamStatus?.status === 'paused') && (
          <>
            <Button 
              className="w-full bg-error hover:bg-error/90 text-white"
              onClick={() => stopStreamMutation.mutate()}
              disabled={stopStreamMutation.isPending}
            >
              <Square className="h-4 w-4 mr-2" />
              Stop Stream
            </Button>
            
          </>
        )}
        
        {streamStatus?.status === 'offline' && (
          <p className="text-sm text-gray-500 text-center">
            Stream is offline. Configure and start streaming from the configuration panel.
          </p>
        )}
      </div>
    </div>
  );
}
