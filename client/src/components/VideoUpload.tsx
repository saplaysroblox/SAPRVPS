import { useState, useRef } from "react";
import { Upload, CloudUpload, FileVideo, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface UploadingFile {
  file: File;
  progress: number;
  id: string;
}

export default function VideoUpload() {
  const [dragActive, setDragActive] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('title', file.name);
      formData.append('duration', '00:00'); // Will be processed server-side in real implementation
      
      const response = await fetch('/api/videos', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
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

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    handleFiles(files);
  };

  const handleFiles = (files: FileList) => {
    Array.from(files).forEach(file => {
      if (file.type.startsWith('video/')) {
        const uploadId = Math.random().toString(36).substring(7);
        
        setUploadingFiles(prev => [...prev, {
          file,
          progress: 0,
          id: uploadId
        }]);

        // Simulate upload progress
        const interval = setInterval(() => {
          setUploadingFiles(prev => 
            prev.map(upload => 
              upload.id === uploadId 
                ? { ...upload, progress: Math.min(upload.progress + 10, 90) }
                : upload
            )
          );
        }, 200);

        uploadMutation.mutate(file, {
          onSettled: () => {
            clearInterval(interval);
            setUploadingFiles(prev => prev.filter(upload => upload.id !== uploadId));
          }
        });
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload MP4, AVI, or MOV files only.",
          variant: "destructive",
        });
      }
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white rounded-lg shadow-material p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Upload Videos</h2>
        <span className="text-sm text-gray-500">Supported: MP4, AVI, MOV</span>
      </div>
      
      {/* Drag and Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          dragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <CloudUpload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Drop video files here</h3>
        <p className="text-gray-600 mb-4">or click to browse</p>
        <Button className="bg-primary hover:bg-primary/90">
          Choose Files
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Upload Progress */}
      {uploadingFiles.length > 0 && (
        <div className="mt-6 space-y-3">
          {uploadingFiles.map((upload) => (
            <div key={upload.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileVideo className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{upload.file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(upload.file.size)}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-32">
                  <Progress value={upload.progress} className="h-2" />
                </div>
                <span className="text-sm text-gray-600 w-10">{upload.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
