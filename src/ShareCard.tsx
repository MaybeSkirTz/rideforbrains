import { t as textForLocale } from './locale-copy';
import { useEffect, useRef, useState } from 'react';
import { cardFormats, shareCardText, type CardFormat, type CardName } from '../shared/share-card';
import { Button, Field, Notice } from './ui';
import { currentLocale } from '../shared/locale';

export default function ShareCard({
  participation,
  eventAt,
  finisher = false,
}: {
  participation: Parameters<typeof shareCardText>[0];
  eventAt: string;
  finisher?: boolean;
}) {
  const [format, setFormat] = useState<CardFormat>('square');
  const [name, setName] = useState<CardName>('private');
  const [error, setError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const { width, height } = cardFormats[format];
  const locale = currentLocale();
  const text = shareCardText(participation, eventAt, name, locale);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const inset = Math.round(width * 0.075);
    const fit = (value: string, y: number, size: number, color: string, weight = 700) => {
      ctx.fillStyle = color;
      ctx.font = `${weight} ${size}px system-ui, sans-serif`;
      ctx.fillText(value, inset, y, width - inset * 2);
    };
    ctx.fillStyle = '#102d30';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#c6e34d';
    ctx.lineWidth = 3;
    ctx.strokeRect(inset / 2, inset / 2, width - inset, height - inset);
    ctx.strokeStyle = '#356d67';
    for (let n = 0; n < 5; n++) {
      ctx.beginPath();
      ctx.moveTo(width * 0.54 + n * 38, height * 0.83);
      ctx.lineTo(width * 0.82 + n * 38, height * 0.42);
      ctx.stroke();
    }
    fit('RIDE FOR BRAINS', height * 0.18, 38, '#c6e34d');
    fit(
      textForLocale(finisher ? 'J’Y ÉTAIS.' : 'JE PARTICIPE.'),
      height * 0.39,
      105,
      '#fffdf4',
      900,
    );
    if (text.name) fit(text.name.toLocaleUpperCase(locale), height * 0.52, 64, '#fffdf4');
    fit(text.activity.toLocaleUpperCase(locale), height * 0.65, 53, '#c6e34d', 800);
    fit(text.date.toLocaleUpperCase(locale), height * 0.75, 34, '#fffdf4');
    fit(textForLocale('Pour eux, chaque kilomètre compte.'), height * 0.9, 34, '#fffdf4', 500);
  }, [width, height, text.name, text.activity, text.date, finisher, locale]);
  const download = () => {
    setError('');
    canvas.current?.toBlob((blob) => {
      if (!blob) {
        setError(textForLocale('L’image n’a pas pu être préparée. Réessayez.'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Ride-For-Brains-' + (finisher ? 'souvenir-' : 'mon-defi-') + format + '.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }, 'image/png');
  };
  return (
    <section className="day-j-share-card">
      <h2>
        {finisher ? textForLocale('Ma carte souvenir') : textForLocale('Ma carte de partage')}
      </h2>
      <p>{textForLocale('Choisissez ce qui apparaîtra sur votre image.')}</p>
      <div className="form-grid">
        <Field label={textForLocale('Format de la carte')}>
          <select value={format} onChange={(e) => setFormat(e.target.value as CardFormat)}>
            {Object.entries(cardFormats).map(([key, value]) => (
              <option value={key} key={key}>
                {textForLocale(value.label)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={textForLocale('Nom affiché sur l’image')}>
          <select value={name} onChange={(e) => setName(e.target.value as CardName)}>
            <option value="private">{textForLocale('Aucun nom')}</option>
            <option value="first">{textForLocale('Mon prénom')}</option>
            <option value="initial">{textForLocale('Mon prénom et mon initiale')}</option>
          </select>
        </Field>
      </div>
      <canvas
        ref={canvas}
        width={width}
        height={height}
        role="img"
        aria-label={`Aperçu de la carte, ${text.activity}, ${text.date}`}
      />
      {error && <Notice error>{error}</Notice>}
      <Button type="button" onClick={download}>
        {textForLocale('Télécharger l’image PNG')}
      </Button>
    </section>
  );
}
