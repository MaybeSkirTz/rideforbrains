import React, { useEffect } from 'react';
import { useApp } from './context';
export default function Turnstile({ onToken }: any) {
  const { data } = useApp();
  const ref = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!data.services.turnstile) return;
    let widget: any;
    let disposed = false;
    const render = () => {
      if (disposed || !ref.current) return;
      const t = (window as any).turnstile;
      if (t)
        widget = t.render(ref.current, {
          sitekey: data.services.turnstile,
          callback: onToken,
          'expired-callback': () => onToken(''),
        });
    };
    const t = (window as any).turnstile;
    let script: HTMLScriptElement | undefined;
    if (t) render();
    else {
      script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = render;
      document.head.appendChild(script);
    }
    return () => {
      disposed = true;
      if (widget !== undefined) (window as any).turnstile?.remove(widget);
    };
  }, [data.services.turnstile]);
  return <div ref={ref} />;
}
