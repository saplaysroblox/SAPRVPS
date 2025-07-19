import { useState, useEffect } from "react";
import { Play, CheckCircle, Eye, EyeOff, ExternalLink, AlertCircle, Monitor, Zap, Volume2, TestTube2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertStreamConfigSchema } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const formSchema = insertStreamConfigSchema.extend({
  streamKey: z.string().min(1, "Stream key is required"),
  rtmpUrl: z.string().optional().or(z.literal("")),
}).refine((data) => {
  // Make rtmpUrl required for custom platform
  if (data.platform === 'custom' && !data.rtmpUrl) {
    return false;
  }
  // Validate URL format for custom platform
  if (data.platform === 'custom' && data.rtmpUrl && !data.rtmpUrl.startsWith('rtmp://')) {
    return false;
  }
  return true;
}, {
  message: "Valid RTMP URL is required for custom platform",
  path: ["rtmpUrl"],
});

export default function StreamConfig() {
  const [showStreamKey, setShowStreamKey] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: streamConfig } = useQuery({
    queryKey: ['/api/stream-config'],
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      platform: 'youtube',
      streamKey: '',
      rtmpUrl: '',
      resolution: '1920x1080',
      framerate: 30,
      bitrate: 2500,
      audioQuality: 128,
      isActive: true,
    },
  });

  // Reset form when data is loaded
  useEffect(() => {
    if (streamConfig) {
      form.reset({
        platform: streamConfig.platform || 'youtube',
        streamKey: streamConfig.streamKey || '',
        rtmpUrl: streamConfig.rtmpUrl || '',
        resolution: streamConfig.resolution || '1920x1080',
        framerate: streamConfig.framerate || 30,
        bitrate: streamConfig.bitrate || 2500,
        audioQuality: streamConfig.audioQuality || 128,
        isActive: true,
      });
    }
  }, [streamConfig, form]);

  const saveConfigMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      await apiRequest('POST', '/api/stream-config', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stream-config'] });
      toast({
        title: "Success",
        description: "Stream configuration saved!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save configuration",
        variant: "destructive",
      });
    },
  });

  const startStreamMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/stream/start');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stream-status'] });
      toast({
        title: "Success",
        description: "Stream started successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start stream",
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/stream/test');
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Connection test successful!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Connection test failed",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    saveConfigMutation.mutate(data);
  };

  const getStreamUrl = (platform: string) => {
    switch (platform) {
      case 'youtube':
        return 'rtmp://a.rtmp.youtube.com/live2';
      case 'twitch':
        return 'rtmp://live.twitch.tv/live';
      case 'facebook':
        return 'rtmps://live-api-s.facebook.com:443/rtmp';
      case 'custom':
        return form.watch('rtmpUrl') || 'rtmp://localhost:1935/live';
      default:
        return '';
    }
  };

  const getPlatformInstructions = (platform: string) => {
    switch (platform) {
      case 'youtube':
        return 'Go to YouTube Studio → Go Live → Stream → Copy Stream Key';
      case 'twitch':
        return 'Go to Twitch Creator Dashboard → Settings → Stream → Copy Primary Stream Key';
      case 'facebook':
        return 'Go to Facebook Live → Use Stream Key → Copy Stream Key';
      case 'custom':
        return 'Enter your custom RTMP server URL and stream key';
      default:
        return '';
    }
  };

  const handleStartStream = () => {
    startStreamMutation.mutate();
  };

  const handleTestConnection = () => {
    testConnectionMutation.mutate();
  };

  const bitrateValue = form.watch('bitrate');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Stream Configuration</h2>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Configure your RTMP streaming settings to broadcast to platforms like YouTube, Twitch, or custom servers.
        </AlertDescription>
      </Alert>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Platform Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                Platform Settings
              </CardTitle>
              <CardDescription>
                Select your streaming platform and configure connection settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Platform Selection */}
              <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="youtube">YouTube</SelectItem>
                        <SelectItem value="twitch">Twitch</SelectItem>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="custom">Custom RTMP</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* RTMP URL for Custom Platform */}
              {form.watch('platform') === 'custom' && (
                <FormField
                  control={form.control}
                  name="rtmpUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RTMP URL</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="rtmp://your-server.com/live"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Platform Instructions */}
              {form.watch('platform') && (
                <div className="bg-blue-50 p-3 rounded-md">
                  <p className="text-sm text-blue-800 font-medium mb-1">How to get your stream key:</p>
                  <p className="text-sm text-blue-700">{getPlatformInstructions(form.watch('platform'))}</p>
                </div>
              )}

              {/* Stream URL Display - Non-custom platforms */}
              {form.watch('platform') && form.watch('platform') !== 'custom' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Stream URL</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={getStreamUrl(form.watch('platform'))}
                      readOnly
                      className="bg-gray-50 text-gray-600"
                    />
                    <Badge variant="outline" className="whitespace-nowrap">
                      Auto-configured
                    </Badge>
                  </div>
                </div>
              )}

              {/* Stream Key */}
              <FormField
                control={form.control}
                name="streamKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stream Key</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showStreamKey ? "text" : "password"}
                          placeholder="Enter your stream key"
                          {...field}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute inset-y-0 right-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowStreamKey(!showStreamKey)}
                        >
                          {showStreamKey ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* RTMP URL for Custom Platform */}
              {form.watch('platform') === 'custom' && (
                <FormField
                  control={form.control}
                  name="rtmpUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RTMP URL</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="rtmp://your-server.com/live"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Action buttons for this card */}
              <div className="flex gap-2 pt-4">
                <Button 
                  type="submit"
                  disabled={saveConfigMutation.isPending}
                  className="flex-1"
                >
                  {saveConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testConnectionMutation.isPending}
                >
                  <TestTube2 className="h-4 w-4 mr-2" />
                  {testConnectionMutation.isPending ? 'Testing...' : 'Test'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Video Quality Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Video Quality (FFmpeg Settings)
              </CardTitle>
              <CardDescription>
                Configure video encoding settings used by FFmpeg for streaming. These settings directly affect stream quality and performance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* FFmpeg Info Alert */}
              <Alert>
                <Zap className="h-4 w-4" />
                <AlertDescription>
                  These settings control how FFmpeg processes your video for streaming. Higher quality uses more bandwidth and CPU.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="resolution"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resolution</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1920x1080">1920x1080 (Full HD)</SelectItem>
                          <SelectItem value="1280x720">1280x720 (HD)</SelectItem>
                          <SelectItem value="854x480">854x480 (SD)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="framerate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Framerate</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="30">30 fps (Smooth)</SelectItem>
                          <SelectItem value="25">25 fps (Standard)</SelectItem>
                          <SelectItem value="24">24 fps (Cinematic)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Bitrate */}
              <FormField
                control={form.control}
                name="bitrate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Video Bitrate (kbps)</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Slider
                          value={[field.value]}
                          onValueChange={(value) => field.onChange(value[0])}
                          min={500}
                          max={6000}
                          step={100}
                          className="w-full"
                        />
                        <div className="flex justify-between text-sm text-gray-500">
                          <span>Low (500)</span>
                          <span className="font-medium">{bitrateValue} kbps</span>
                          <span>High (6000)</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {bitrateValue < 1500 && "Low quality, small file size"}
                          {bitrateValue >= 1500 && bitrateValue < 3000 && "Medium quality, balanced size"}
                          {bitrateValue >= 3000 && "High quality, large file size"}
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Audio Settings */}
              <FormField
                control={form.control}
                name="audioQuality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Audio Bitrate</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="128">128 kbps (High Quality)</SelectItem>
                        <SelectItem value="96">96 kbps (Medium Quality)</SelectItem>
                        <SelectItem value="64">64 kbps (Low Quality)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Video Quality Save Button */}
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  type="submit"
                  disabled={saveConfigMutation.isPending}
                  className="flex-1"
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  {saveConfigMutation.isPending ? 'Saving...' : 'Save Video Quality Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stream Action Buttons */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Stream Controls
              </CardTitle>
              <CardDescription>
                Start streaming once your configuration is saved and tested.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button 
                  type="button"
                  onClick={handleStartStream}
                  disabled={startStreamMutation.isPending || !form.watch('streamKey')}
                  className="flex-1"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {startStreamMutation.isPending ? 'Starting...' : 'Start Stream'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testConnectionMutation.isPending || !form.watch('streamKey')}
                >
                  <TestTube2 className="h-4 w-4 mr-2" />
                  {testConnectionMutation.isPending ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
