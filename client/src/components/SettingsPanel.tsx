import { useState, useEffect } from "react";
import { Settings, X, Monitor, Wifi, Database, Info, Moon, Sun, RotateCcw, Server, Globe, HardDrive, Download, Upload, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { SystemConfig, InsertSystemConfig } from "@shared/schema";

interface Settings {
  theme: 'light' | 'dark';
  autoRefresh: boolean;
  defaultQuality: string;
  bufferSize: number;
  autoRestart: boolean;
  refreshInterval: number;
}

export default function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  
  // Load settings from localStorage with defaults
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('sa-plays-roblox-streamer-settings');
    return saved ? JSON.parse(saved) : {
      theme: 'light',
      autoRefresh: true,
      defaultQuality: '1280x720',
      bufferSize: 5,
      autoRestart: true,
      refreshInterval: 5000
    };
  });

  // Database connection status - using actual database endpoint
  const { data: dbStatus, isLoading: dbLoading } = useQuery({
    queryKey: ['/api/system-config'],
    refetchInterval: settings.autoRefresh ? settings.refreshInterval : false,
  });

  // System configuration
  const { data: systemConfig, isLoading: configLoading } = useQuery({
    queryKey: ['/api/system-config'],
    refetchInterval: settings.autoRefresh ? settings.refreshInterval : false,
  });

  // Form state for system configuration
  const [configForm, setConfigForm] = useState<InsertSystemConfig>({
    rtmpPort: 1935,
    webPort: 5000,
    dbHost: "localhost",
    dbPort: 5432,
    dbName: "streaming_db",
    dbUser: "",
    dbPassword: "",
    useExternalDb: false,
  });

  // Update form when system config loads
  useEffect(() => {
    if (systemConfig) {
      setConfigForm({
        rtmpPort: systemConfig.rtmpPort,
        webPort: systemConfig.webPort,
        dbHost: systemConfig.dbHost,
        dbPort: systemConfig.dbPort,
        dbName: systemConfig.dbName,
        dbUser: systemConfig.dbUser,
        dbPassword: systemConfig.dbPassword,
        useExternalDb: systemConfig.useExternalDb,
      });
    }
  }, [systemConfig]);

  // System config mutation
  const updateSystemConfig = useMutation({
    mutationFn: async (config: InsertSystemConfig) => {
      return apiRequest('/api/system-config', {
        method: 'POST',
        body: JSON.stringify(config),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-config'] });
      toast({
        title: "Configuration Updated",
        description: "System configuration has been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to update system configuration: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Database management mutations
  const installDatabase = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/database/install', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: "Database Installed",
        description: "Default database schema installed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Installation Failed",
        description: "Failed to install database: " + error.message,
        variant: "destructive",
      });
    },
  });

  const createBackup = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/database/backup', {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Backup Created",
        description: `Database backup saved as ${data.filename}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Backup Failed",
        description: "Failed to create backup: " + error.message,
        variant: "destructive",
      });
    },
  });

  const restoreDatabase = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('backupFile', file);
      return fetch('/api/database/restore', {
        method: 'POST',
        body: formData,
      }).then(res => res.json());
    },
    onSuccess: () => {
      toast({
        title: "Database Restored",
        description: "Database restored successfully from backup.",
      });
    },
    onError: (error) => {
      toast({
        title: "Restore Failed",
        description: "Failed to restore database: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('sa-plays-roblox-streamer-settings', JSON.stringify(settings));
    
    // Apply theme changes
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    toast({
      title: "Settings Updated",
      description: `${key.charAt(0).toUpperCase() + key.slice(1)} has been updated.`,
    });
  };

  // Handle file input for database restore
  const handleRestoreFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.sql')) {
        toast({
          title: "Invalid File",
          description: "Please select a .sql backup file.",
          variant: "destructive",
        });
        return;
      }
      restoreDatabase.mutate(file);
    }
  };

  const resetSettings = () => {
    const defaultSettings: Settings = {
      theme: 'light',
      autoRefresh: true,
      defaultQuality: '1280x720',
      bufferSize: 5,
      autoRestart: true,
      refreshInterval: 5000
    };
    setSettings(defaultSettings);
    toast({
      title: "Settings Reset",
      description: "All settings have been reset to default values.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure application settings, streaming preferences, and view system information.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="streaming">Streaming</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Monitor className="h-5 w-5" />
                  <span>Display</span>
                </CardTitle>
                <CardDescription>
                  Configure how the application looks and behaves
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="theme-select" className="font-medium">Theme</Label>
                    <p className="text-sm text-gray-600">Choose your preferred theme</p>
                  </div>
                  <Select value={settings.theme} onValueChange={(value: 'light' | 'dark') => updateSetting('theme', value)}>
                    <SelectTrigger id="theme-select" className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">
                        <div className="flex items-center gap-2">
                          <Sun className="h-4 w-4" />
                          Light
                        </div>
                      </SelectItem>
                      <SelectItem value="dark">
                        <div className="flex items-center gap-2">
                          <Moon className="h-4 w-4" />
                          Dark
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-refresh" className="font-medium">Auto-refresh</Label>
                    <p className="text-sm text-gray-600">Automatically refresh stream status</p>
                  </div>
                  <Switch 
                    id="auto-refresh"
                    checked={settings.autoRefresh}
                    onCheckedChange={(checked) => updateSetting('autoRefresh', checked)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="refresh-interval" className="font-medium">Refresh Interval</Label>
                    <span className="text-sm text-gray-600">{settings.refreshInterval / 1000}s</span>
                  </div>
                  <Slider
                    id="refresh-interval"
                    value={[settings.refreshInterval]}
                    onValueChange={(value) => updateSetting('refreshInterval', value[0])}
                    min={1000}
                    max={30000}
                    step={1000}
                    className="w-full"
                    disabled={!settings.autoRefresh}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>1s</span>
                    <span>30s</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="system" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Server className="h-5 w-5" />
                  <span>Server Configuration</span>
                </CardTitle>
                <CardDescription>
                  Configure RTMP and web server port settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rtmp-port" className="font-medium">RTMP Port</Label>
                    <Input
                      id="rtmp-port"
                      type="number"
                      value={configForm.rtmpPort}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, rtmpPort: parseInt(e.target.value) || 1935 }))}
                      placeholder="1935"
                      className="w-full"
                    />
                    <p className="text-sm text-gray-600">Port for RTMP streaming server</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="web-port" className="font-medium">Web Port</Label>
                    <Input
                      id="web-port"
                      type="number"
                      value={configForm.webPort}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, webPort: parseInt(e.target.value) || 5000 }))}
                      placeholder="5000"
                      className="w-full"
                    />
                    <p className="text-sm text-gray-600">Port for web application server</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <HardDrive className="h-5 w-5" />
                  <span>Database Configuration</span>
                </CardTitle>
                <CardDescription>
                  Configure external database connection settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="use-external-db" className="font-medium">Use External Database</Label>
                    <p className="text-sm text-gray-600">Connect to an external PostgreSQL database</p>
                  </div>
                  <Switch 
                    id="use-external-db"
                    checked={configForm.useExternalDb}
                    onCheckedChange={(checked) => setConfigForm(prev => ({ ...prev, useExternalDb: checked }))}
                  />
                </div>

                {configForm.useExternalDb && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="db-host" className="font-medium">Database Host</Label>
                        <Input
                          id="db-host"
                          value={configForm.dbHost}
                          onChange={(e) => setConfigForm(prev => ({ ...prev, dbHost: e.target.value }))}
                          placeholder="localhost"
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="db-port" className="font-medium">Database Port</Label>
                        <Input
                          id="db-port"
                          type="number"
                          value={configForm.dbPort}
                          onChange={(e) => setConfigForm(prev => ({ ...prev, dbPort: parseInt(e.target.value) || 5432 }))}
                          placeholder="5432"
                          className="w-full"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="db-name" className="font-medium">Database Name</Label>
                      <Input
                        id="db-name"
                        value={configForm.dbName}
                        onChange={(e) => setConfigForm(prev => ({ ...prev, dbName: e.target.value }))}
                        placeholder="streaming_db"
                        className="w-full"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="db-user" className="font-medium">Username</Label>
                        <Input
                          id="db-user"
                          value={configForm.dbUser}
                          onChange={(e) => setConfigForm(prev => ({ ...prev, dbUser: e.target.value }))}
                          placeholder="postgres"
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="db-password" className="font-medium">Password</Label>
                        <Input
                          id="db-password"
                          type="password"
                          value={configForm.dbPassword}
                          onChange={(e) => setConfigForm(prev => ({ ...prev, dbPassword: e.target.value }))}
                          placeholder="••••••••"
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t space-y-4">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Database Management</h4>
                    
                    <div className="grid grid-cols-1 gap-2">
                      <Button
                        onClick={() => installDatabase.mutate()}
                        disabled={installDatabase.isPending}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        {installDatabase.isPending ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Database className="h-4 w-4 mr-2" />
                        )}
                        Install Default Database
                      </Button>
                      
                      <Button
                        onClick={() => createBackup.mutate()}
                        disabled={createBackup.isPending}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        {createBackup.isPending ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        Create Backup
                      </Button>
                      
                      <div className="relative">
                        <input
                          type="file"
                          accept=".sql"
                          onChange={handleRestoreFile}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          disabled={restoreDatabase.isPending}
                        />
                        <Button
                          disabled={restoreDatabase.isPending}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          {restoreDatabase.isPending ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          Restore from Backup
                        </Button>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-500">
                      Database operations may require application restart
                    </p>
                  </div>

                  <div className="pt-3 border-t">
                    <Button 
                      onClick={() => updateSystemConfig.mutate(configForm)}
                      disabled={updateSystemConfig.isPending || configLoading}
                      className="w-full"
                    >
                      {updateSystemConfig.isPending ? "Saving..." : "Save Configuration"}
                    </Button>
                    <p className="text-sm text-gray-600 mt-2">
                      Changes will take effect after application restart
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="streaming" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Wifi className="h-5 w-5" />
                  <span>Streaming Settings</span>
                </CardTitle>
                <CardDescription>
                  Configure streaming quality and performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="default-quality" className="font-medium">Default Quality</Label>
                    <p className="text-sm text-gray-600">Default streaming quality for new configurations</p>
                  </div>
                  <Select value={settings.defaultQuality} onValueChange={(value) => updateSetting('defaultQuality', value)}>
                    <SelectTrigger id="default-quality" className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1920x1080">1920x1080 (Full HD)</SelectItem>
                      <SelectItem value="1280x720">1280x720 (HD)</SelectItem>
                      <SelectItem value="854x480">854x480 (SD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="buffer-size" className="font-medium">Buffer Size</Label>
                    <span className="text-sm text-gray-600">{settings.bufferSize}s</span>
                  </div>
                  <Slider
                    id="buffer-size"
                    value={[settings.bufferSize]}
                    onValueChange={(value) => updateSetting('bufferSize', value[0])}
                    min={1}
                    max={30}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>1s</span>
                    <span>30s</span>
                  </div>
                  <p className="text-sm text-gray-600">Video buffer size affects stream stability and latency</p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-restart" className="font-medium">Auto-restart</Label>
                    <p className="text-sm text-gray-600">Automatically restart failed streams</p>
                  </div>
                  <Switch 
                    id="auto-restart"
                    checked={settings.autoRestart}
                    onCheckedChange={(checked) => updateSetting('autoRestart', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="about" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Info className="h-5 w-5" />
                  <span>About Sa Plays Roblox Streamer</span>
                </CardTitle>
                <CardDescription>
                  Information about this application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Version</span>
                    <span className="text-gray-600">1.0.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Build</span>
                    <span className="text-gray-600">Jan 2025</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Database</span>
                    {dbLoading ? (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                        <Database className="h-3 w-3 mr-1" />
                        Checking...
                      </Badge>
                    ) : dbStatus ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        <Database className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-700">
                        <Database className="h-3 w-3 mr-1" />
                        Error
                      </Badge>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">FFmpeg</span>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      <Monitor className="h-3 w-3 mr-1" />
                      Available
                    </Badge>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    Sa Plays Roblox Streamer is a web-based video streaming application that allows you to upload videos, 
                    manage playlists, and stream content to various platforms with real-time controls.
                  </p>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-sm">Reset Settings</h4>
                      <p className="text-sm text-gray-600">Restore all settings to default values</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={resetSettings}
                      className="text-red-600 hover:text-red-700"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Reset
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}