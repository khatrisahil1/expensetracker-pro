import React, { useEffect, useRef, useState } from 'react';
import { createGeminiClient } from '../utils/gemini';

export type ReceiptScanResult = {
  merchant?: string;
  totalAmount?: number;
  date?: string;
  category?: string;
};

interface ReceiptScannerModalProps {
  onClose: () => void;
  onResult: (result: ReceiptScanResult) => void;
}

const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({ onClose, onResult }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(mediaStream);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = mediaStream; }, 50);
    } catch (err: any) {
      setError(err?.message || 'Could not access camera.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setPreview(null);
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsProcessing(true);
    setError(null);

    const canvas = canvasRef.current;
    const video = videoRef.current;

    const maxWidth = 800;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Unable to access canvas.');
      setIsProcessing(false);
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setPreview(dataUrl);

    try {
      const base64 = dataUrl.split(',')[1];
      const ai = createGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64 } },
            { text: 'Extract receipt details as JSON: merchant, totalAmount, date (YYYY-MM-DD), category. Only output JSON.' }
          ]
        },
        config: { responseMimeType: 'application/json' }
      });

      const raw = response.text.trim();
      const jsonText = raw.includes('{') ? raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1) : raw;
      const parsed = JSON.parse(jsonText);

      onResult({
        merchant: parsed.merchant || parsed.vendor || parsed.store,
        totalAmount: parsed.totalAmount || parsed.total || parsed.amount ? Number(parsed.totalAmount || parsed.total || parsed.amount) : undefined,
        date: parsed.date,
        category: parsed.category,
      });
      stopCamera();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not parse receipt. Try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl bg-surface-light dark:bg-surface-dark rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light dark:border-border-dark">
          <div>
            <h3 className="text-lg font-black">Receipt Scanner</h3>
            <p className="text-xs text-text-light-muted dark:text-text-dark-muted">Snap a receipt and auto-fill transaction details.</p>
          </div>
          <button onClick={() => { stopCamera(); onClose(); }} className="size-10 rounded-full hover:bg-gray-100 dark:hover:bg-surface-darker transition-all"><span className="material-symbols-outlined">close</span></button>
        </div>

        <div className="p-6">
          {error && (
            <div className="p-3 mb-4 rounded-xl bg-red-500/10 text-red-600 font-bold text-sm">{error}</div>
          )}

          <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black/10 border border-border-light dark:border-border-dark">
            {stream ? (
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-text-light-muted">
                <span className="material-symbols-outlined text-5xl">photo_camera</span>
                <p className="text-sm">No camera active.</p>
              </div>
            )}

            {preview && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <img src={preview} className="max-h-full max-w-full" alt="Preview" />
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button onClick={startCamera} disabled={!!stream} className="flex-1 bg-primary text-black py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-primary-hover transition-all">{stream ? 'Camera Active' : 'Start Camera'}</button>
            <button onClick={captureAndAnalyze} disabled={!stream || isProcessing} className="flex-1 bg-indigo-500 text-white py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-indigo-400 transition-all">
              {isProcessing ? 'Analyzing…' : 'Capture & Analyze'}
            </button>
            <button onClick={stopCamera} disabled={!stream} className="flex-1 bg-gray-100 dark:bg-surface-darker text-text-light-muted py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-surface-darker transition-all">Stop</button>
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>
      </div>
    </div>
  );
};

export default ReceiptScannerModal;
