import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Maximize2, X } from 'lucide-react';
export type AlbumPhoto = { url: string; alt: string; caption?: string };
export const SLIDE_INTERVAL = 6000;
export const slideIndex = (index: number, delta: number, count: number) =>
  count > 0 ? (((index + delta) % count) + count) % count : 0;
function motionOff() {
  if (typeof window === 'undefined') return true;
  try {
    return (
      matchMedia('(prefers-reduced-motion: reduce)').matches ||
      localStorage.getItem('rfb-motion') === 'off'
    );
  } catch {
    return true;
  }
}
export default function PhotoAlbum({
  photos,
  label = 'Photos de Ride For Brains',
}: {
  photos: AlbumPhoto[];
  label?: string;
}) {
  const [selected, setSelected] = useState(0),
    [playing, setPlaying] = useState(() => !motionOff()),
    [hovered, setHovered] = useState(false),
    [focused, setFocused] = useState(false),
    [focusPlayback, setFocusPlayback] = useState(false),
    [visible, setVisible] = useState(false),
    [pageVisible, setPageVisible] = useState(true),
    [zoom, setZoom] = useState(false);
  const root = useRef<HTMLElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    strip = useRef<HTMLDivElement>(null),
    thumbs = useRef<(HTMLButtonElement | null)[]>([]),
    swipe = useRef<[number, number] | null>(null),
    suppressClickUntil = useRef(0);
  const id = useId(),
    count = photos.length,
    index = Math.min(selected, Math.max(0, count - 1)),
    photo = photos[index];
  const move = (delta: number) =>
    setSelected((i) => slideIndex(Math.min(i, Math.max(0, count - 1)), delta, count));
  useEffect(() => setSelected((i) => Math.min(i, Math.max(0, count - 1))), [count]);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => {
      if (motionOff()) setPlaying(false);
    };
    const updateVisibility = () => setPageVisible(!document.hidden);
    updateMotion();
    updateVisibility();
    media.addEventListener('change', updateMotion);
    window.addEventListener('rfb-motion', updateMotion);
    window.addEventListener('storage', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
            threshold: 0.1,
          });
    if (root.current) observer?.observe(root.current);
    if (!observer) setVisible(true);
    return () => {
      observer?.disconnect();
      media.removeEventListener('change', updateMotion);
      window.removeEventListener('rfb-motion', updateMotion);
      window.removeEventListener('storage', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, [count > 0]);
  useEffect(() => {
    if (
      !playing ||
      hovered ||
      (focused && !focusPlayback) ||
      !visible ||
      !pageVisible ||
      zoom ||
      count < 2
    )
      return;
    const timer = setTimeout(() => setSelected((i) => slideIndex(i, 1, count)), SLIDE_INTERVAL);
    return () => clearTimeout(timer);
  }, [playing, hovered, focused, focusPlayback, visible, pageVisible, zoom, count, index]);
  useEffect(() => {
    const button = thumbs.current[index],
      container = strip.current;
    if (!button || !container) return;
    if (document.activeElement?.classList.contains('album-thumb'))
      button.focus({ preventScroll: true });
    const left =
      button.getBoundingClientRect().left -
      container.getBoundingClientRect().left +
      container.scrollLeft -
      (container.clientWidth - button.clientWidth) / 2;
    container.scrollTo({ left, behavior: motionOff() ? 'instant' : 'smooth' });
  }, [index]);
  useEffect(() => {
    if (zoom && !dialog.current?.open) dialog.current?.showModal();
    if (!zoom && dialog.current?.open) dialog.current?.close();
  }, [zoom]);
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      move(-1);
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      move(1);
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setSelected(0);
    }
    if (e.key === 'End') {
      e.preventDefault();
      setSelected(Math.max(0, count - 1));
    }
  };
  const touchStart = (e: React.TouchEvent) => {
    swipe.current = [e.touches[0].clientX, e.touches[0].clientY];
  };
  const touchEnd = (e: React.TouchEvent) => {
    if (!swipe.current) return;
    const dx = e.changedTouches[0].clientX - swipe.current[0],
      dy = e.changedTouches[0].clientY - swipe.current[1];
    swipe.current = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      move(dx < 0 ? 1 : -1);
      suppressClickUntil.current = Date.now() + 400;
    }
  };
  const arrows = () =>
    count > 1 && (
      <>
        <button
          type="button"
          className="album-arrow previous"
          onClick={() => move(-1)}
          aria-label="Photo précédente"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          className="album-arrow next"
          onClick={() => move(1)}
          aria-label="Photo suivante"
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </>
    );
  if (!photo) return null;
  return (
    <section
      ref={root}
      className="photo-album"
      aria-label={label}
      aria-roledescription="carrousel"
      onKeyDown={keys}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => {
        setFocused(true);
        setFocusPlayback(false);
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
      }}
    >
      <div className="album-toolbar">
        <p>{label}</p>
        <span
          className="album-count"
          aria-live={playing && !focused ? 'off' : 'polite'}
          aria-atomic="true"
        >
          {index + 1} / {count}
        </span>
      </div>
      <div className="album-stage" onTouchStart={touchStart} onTouchEnd={touchEnd}>
        <button
          type="button"
          className="album-image"
          aria-label={'Agrandir la photo ' + (index + 1) + ' : ' + photo.alt}
          aria-haspopup="dialog"
          onClick={() => {
            if (Date.now() >= suppressClickUntil.current) setZoom(true);
          }}
        >
          <img
            key={photo.url + ':' + index}
            src={photo.url}
            alt={photo.alt}
            width="1200"
            height="800"
            loading="lazy"
            decoding="async"
          />
        </button>
        {arrows()}
      </div>
      <div className="album-footer">
        <p className="album-caption">{photo.caption || '\u00a0'}</p>
        <div className="album-actions">
          {count > 1 && (
            <button
              type="button"
              className="album-control"
              aria-pressed={playing}
              aria-label={
                playing
                  ? 'Mettre en pause le défilement automatique'
                  : 'Activer le défilement automatique'
              }
              onClick={() => {
                setFocusPlayback(!playing);
                setPlaying((p) => !p);
              }}
            >
              {playing ? (
                <Pause size={17} aria-hidden="true" />
              ) : (
                <Play size={17} aria-hidden="true" />
              )}
              {playing ? 'Pause' : 'Lecture auto'}
            </button>
          )}
          <button
            type="button"
            className="album-control"
            onClick={() => setZoom(true)}
            aria-label="Agrandir la photo"
          >
            <Maximize2 size={17} aria-hidden="true" />
            <span>Agrandir</span>
          </button>
        </div>
      </div>
      <div className="album-thumbs" ref={strip} role="group" aria-label="Choisir une photo">
        {photos.map((p, i) => (
          <button
            ref={(el) => {
              thumbs.current[i] = el;
            }}
            key={p.url + ':' + i}
            type="button"
            className="album-thumb"
            tabIndex={i === index ? 0 : -1}
            aria-label={'Afficher la photo ' + (i + 1) + ' sur ' + count + ' : ' + p.alt}
            aria-current={i === index ? 'true' : undefined}
            onClick={() => setSelected(i)}
          >
            <img src={p.url} alt="" width="90" height="64" loading="lazy" decoding="async" />
          </button>
        ))}
      </div>
      <dialog
        className="photo-lightbox"
        ref={dialog}
        aria-labelledby={id + '-title'}
        onCancel={() => setZoom(false)}
        onClose={() => setZoom(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setZoom(false);
        }}
      >
        <div className="album-lightbox-header">
          <h2 id={id + '-title'}>{label}</h2>
          <span>
            {index + 1} / {count}
          </span>
          <button
            type="button"
            className="album-control"
            aria-label="Fermer la photo agrandie"
            onClick={() => setZoom(false)}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="album-lightbox-stage" onTouchStart={touchStart} onTouchEnd={touchEnd}>
          <img src={photo.url} alt={photo.alt} width="1600" height="1200" />
          {arrows()}
        </div>
        {photo.caption && <p className="album-lightbox-caption">{photo.caption}</p>}
      </dialog>
    </section>
  );
}
