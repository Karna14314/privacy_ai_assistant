import { useState, useCallback, useRef, useEffect } from 'react';
export interface UseMicrophonePermissionsReturn {
  permissionStatus: 'prompt' | 'granted' | 'denied' | 'checking';
  isRequestingPermission: boolean;
  error: string | null;
  requestMicrophonePermission: () => Promise<boolean>;
  checkPermissionStatus: () => Promise<void>;
  hasPermission: boolean;
}
export const useMicrophonePermissions = (): UseMicrophonePermissionsReturn => {
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('prompt');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const checkPermissionStatus = useCallback(async (): Promise<void> => {
    try {
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: 'microphone' });
        setPermissionStatus(permission.state);
        permission.addEventListener('change', () => {
          setPermissionStatus(permission.state);
        });
      }
    } catch (err) {
      console.warn('Permissions API not supported, will check on request');
    }
  }, []);
  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    setIsRequestingPermission(true);
    setError(null);
    try {
      await checkPermissionStatus();
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      setPermissionStatus('granted');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      streamRef.current = stream;
      console.log('✅ Microphone permission granted');
      return true;
    } catch (err: any) {
      console.error('❌ Microphone permission error:', err);
      let errorMessage = 'Failed to access microphone';
      if (err.name === 'NotAllowedError') {
        setPermissionStatus('denied');
        errorMessage = 'Microphone access denied. Please enable microphone access in your browser settings.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Microphone is already in use by another application.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'Microphone does not support the required audio settings.';
      } else {
        errorMessage = `Microphone access failed: ${err.message}`;
      }
      setError(errorMessage);
      return false;
    } finally {
      setIsRequestingPermission(false);
    }
  }, [checkPermissionStatus]);
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
  return {
    permissionStatus,
    isRequestingPermission,
    error,
    requestMicrophonePermission,
    checkPermissionStatus,
    hasPermission: permissionStatus === 'granted'
  };
};
