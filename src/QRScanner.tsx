import { useEffect, useRef, useState } from 'react';
import { Button, Notice } from './ui';
export default function QRScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<number | undefined>(undefined),
    [open, setOpen] = useState(false),
    [error, setError] = useState('');
  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (timer.current) clearInterval(timer.current);
    setOpen(false);
  };
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );
  const start = async () => {
    setError('');
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 960 } },
        audio: false,
      });
      stream.current = media;
      setOpen(true);
      const decode = (await import('jsqr')).default,
        canvas = document.createElement('canvas');
      timer.current = window.setInterval(() => {
        const v = video.current;
        if (!v) return;
        if (v.srcObject !== media) {
          v.srcObject = media;
          void v.play().catch(() => {});
        }
        if (v.readyState < 2) return;
        const ratio = Math.min(1, 960 / v.videoWidth);
        canvas.width = Math.round(v.videoWidth * ratio);
        canvas.height = Math.round(v.videoHeight * ratio);
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return;
        context.drawImage(v, 0, 0, canvas.width, canvas.height);
        const code = decode(
          context.getImageData(0, 0, canvas.width, canvas.height).data,
          canvas.width,
          canvas.height,
        );
        if (code) {
          stop();
          onCode(code.data);
        }
      }, 250);
    } catch {
      stop();
      setError('Caméra indisponible. Utilisez un lecteur USB ou saisissez le code.');
    }
  };
  return (
    <div className="qr-scanner">
      <Button type="button" className="button light" onClick={open ? stop : start}>
        {open ? 'Fermer la caméra' : 'Scanner un billet avec la caméra'}
      </Button>
      {open && (
        <video
          className="checkin-video"
          ref={video}
          autoPlay
          muted
          playsInline
          aria-label="Caméra locale de scan du billet"
        />
      )}
      {error && <Notice error>{error}</Notice>}
    </div>
  );
}
