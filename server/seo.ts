import type { Env } from './types';
import { parse } from './types';
import { calendarICS } from '../shared/event';
import { ageLabel } from '../shared/participation';
import { englishLegal, frenchPath, localizedPath, localeForPath } from '../shared/locale';
import { englishPageMeta } from './english';
const escape = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const pages: Record<string, [string, string]> = {
  '/': [
    'Ride For Brains',
    'Vélo, course et marche pour se rassembler autour de la recherche sur le cerveau.',
  ],
  '/activites': ['Les activités', 'Vélo 100 km, course 10, 5 et 2 km, marche 5 km.'],
  '/participants': [
    'Les participants',
    'Découvrez les participations confirmées par activité et les noms affichés avec accord.',
  ],
  '/velo': ['Vélo 100 km', 'Une sortie à vélo de 100 km pour Ride For Brains.'],
  '/course': ['Course 10, 5 et 2 km', 'Choisissez votre distance de course pour Ride For Brains.'],
  '/marche': ['Marche 5 km', 'Cinq kilomètres à pied pour se retrouver.'],
  '/cause': [
    'La cause',
    'Soutenez la collecte Ride For Brains, hébergée sur la plateforme officielle de collecte de fonds de Brain Canada.',
  ],
  '/equipe': ['Notre histoire', 'Thomas, François-Xavier et Sammy : l’équipe de Ride For Brains.'],
  '/infos': [
    'Informations pratiques',
    'Accueil, activités et informations confirmées pour préparer votre journée.',
  ],
  '/contact': ['Nous joindre', 'Contactez l’équipe de Ride For Brains.'],
  '/faq': [
    'Questions fréquentes',
    'Les réponses de l’organisation pour préparer votre participation.',
  ],
  '/benevolat': ['Devenir bénévole', 'Proposez votre aide pour Ride For Brains.'],
  '/partenaires': ['Devenir partenaire', 'Contactez l’organisation pour soutenir l’événement.'],
  '/equipes': ['Les équipes', 'Découvrez les équipes publiques de Ride For Brains.'],
  '/histoires': ['Pourquoi je participe', 'Les histoires des participants à Ride For Brains.'],
  '/pour-eux': ['Pour eux', 'Les dédicaces des participants à Ride For Brains.'],
  '/impact': [
    'Notre impact',
    'Les défis choisis collectivement par les participants à Ride For Brains.',
  ],
  '/ou-va-mon-argent': [
    'Où va mon argent?',
    'Les frais d’inscription à Ride For Brains et les dons à Brain Canada sont distincts.',
  ],
};
export async function publicDocument(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url),
    originalPath = url.pathname;
  const locale = localeForPath(originalPath),
    en = locale === 'en-CA';
  const aliases: Record<string, string> = {
    '/benevoles': '/benevolat',
    '/parcours': '/infos',
    '/annulation': '/conditions',
  };
  const path = aliases[originalPath] || frenchPath(originalPath);
  if (path === '/robots.txt')
    return new Response(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /organisation\nDisallow: /api/\nDisallow: /connexion\nDisallow: /compte\nDisallow: /espace\nDisallow: /inscription\nDisallow: /attente\nDisallow: /billet\nDisallow: /recu\nDisallow: /confirmer-courriel\nDisallow: /autorisations-parentales\nDisallow: /transfert\nSitemap: ${env.APP_URL}/sitemap.xml\n`,
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  const htmlPage = path === '/' || !path.split('/').pop()?.includes('.');
  if (!htmlPage && !['/sitemap.xml', '/calendrier.ics'].includes(path))
    return env.ASSETS.fetch(request);
  const s = parse(
    (await env.DB.prepare('SELECT data FROM settings WHERE id=1').first<any>())?.data,
  );
  if (en && !s.english?.published && originalPath !== path)
    return Response.redirect(env.APP_URL + path + url.search + url.hash, 302);
  if (originalPath === '/en') return Response.redirect(env.APP_URL + '/en/' + url.search, 301);
  const activities = (
    await env.DB.prepare(
      'SELECT id,name,sport,distance,price,enabled FROM activities WHERE enabled=1',
    ).all<any>()
  ).results;
  if (path === '/calendrier.ics')
    return new Response(calendarICS(s, env.APP_URL), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="ride-for-brains.ics"',
        'Cache-Control': 'public, max-age=300',
      },
    });
  if (path === '/sitemap.xml')
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' +
        [...Object.keys(pages), ...activities.map((a) => '/activites/' + a.id)]
          .flatMap((p) => {
            const english = localizedPath(p, 'en-CA');
            const loc = (address: string) =>
              '<url><loc>' + escape(env.APP_URL + address) + '</loc>';
            if (!s.english?.published || english === p) return [loc(p) + '</url>'];
            const alternate =
              '<xhtml:link rel="alternate" hreflang="fr-CA" href="' +
              escape(env.APP_URL + p) +
              '"/><xhtml:link rel="alternate" hreflang="en-CA" href="' +
              escape(env.APP_URL + english) +
              '"/>';
            return [loc(p) + alternate + '</url>', loc(english) + alternate + '</url>'];
          })
          .join('') +
        '</urlset>',
      {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      },
    );
  const activity = path.startsWith('/activites/')
    ? activities.find((a) => path === '/activites/' + a.id)
    : null;
  const privatePage =
    /^\/(admin|organisation|api|connexion|compte|espace|mon-jour-j|ma-communaute|souvenir|inscription|attente|billet|billet-personnel|recu|confirmer-courriel|transfert|autorisations-parentales|desabonnement|courriels-locaux)(\/|$)/.test(
      path,
    ) || path.startsWith('/equipes/');
  const known =
    !!pages[path] ||
    !!activity ||
    privatePage ||
    ['/conditions', '/confidentialite'].includes(path);
  const indexable =
    !privatePage &&
    known &&
    !(en && ['/conditions', '/confidentialite'].includes(path) && !englishLegal(s));
  const bilingual =
    indexable &&
    !!s.english?.published &&
    localizedPath(path, 'en-CA') !== path &&
    (!['/conditions', '/confidentialite'].includes(path) || englishLegal(s));
  const copy = en ? englishPageMeta[path] : pages[path];
  const activityName =
    activity && ((en && s.english?.activities?.[activity.id]?.name) || activity.name);
  const price = activity
    ? new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(
        activity.price / 100,
      )
    : '';
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeZone: 'America/Toronto',
  }).format(new Date(s.eventAt));
  const title = activity
    ? `${(en ? { velo: 'Cycling', course: 'Running', marche: 'Walking' } : { velo: 'Vélo', course: 'Course', marche: 'Marche' })[activity.sport as 'velo' | 'course' | 'marche']} — ${activity.distance} · ${activityName} · ${price}`
    : copy?.[0] || 'Ride For Brains';
  const pageTitle =
    path === '/'
      ? `${s.title || 'Ride For Brains'} — ${en ? 'Cycling, running and walking' : 'Vélo, course et marche'} · ${date}`
      : `${title} — Ride For Brains`;
  const description = activity
    ? en
      ? `${activityName}, ${activity.distance}, ${date}. ${price} CAD per entry. Registration fees are separate from donations.`
      : `${activityName}, ${activity.distance}, le ${date}. ${price} CAD par participation. ${ageLabel(activity.sport)}. Frais d’inscription distincts des dons.`
    : `${copy?.[1] || 'Ride For Brains.'} ${en ? '' : s.edition + ' · '}${date} · ${en ? 'Check-in opens at ' + s.reception : 'Accueil à ' + s.reception.replace(':', ' h ')}.`;
  const canonical = env.APP_URL + localizedPath(path, locale),
    image =
      env.APP_URL +
      '/social/' +
      (activity?.sport ||
        (['velo', 'course', 'marche'].includes(path.slice(1)) ? path.slice(1) : 'event')) +
      '.png';
  const event = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: s.title + ' — ' + s.edition,
    inLanguage: locale,
    description,
    startDate: s.eventAt,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: env.APP_URL + localizedPath('/', locale),
    image: [image],
    organizer: { '@type': 'Organization', '@id': env.APP_URL + '/#organization' },
    ...(s.location ? { location: { '@type': 'Place', name: s.location } } : {}),
    offers: activities.map((a) => ({
      '@type': 'Offer',
      name: ((en && s.english?.activities?.[a.id]?.name) || a.name) + ' ' + a.distance,
      price: (a.price / 100).toFixed(2),
      priceCurrency: 'CAD',
      url: env.APP_URL + localizedPath('/activites/' + a.id, locale),
    })),
  };
  const organization = {
    '@type': 'Organization',
    '@id': env.APP_URL + '/#organization',
    name: s.title,
    url: env.APP_URL,
    logo: env.APP_URL + '/assets/ride-for-brains.png',
    email: s.contact,
    sameAs: (s.editorial?.socialLinks || [])
      .map((r: any) => r.url)
      .filter((url: string) => url.startsWith('https://')),
  };
  const breadcrumbs = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: en ? 'Home' : 'Accueil',
        item: env.APP_URL + localizedPath('/', locale),
      },
      ...(path === '/'
        ? []
        : [
            ...(activity
              ? [
                  {
                    '@type': 'ListItem',
                    position: 2,
                    name: en ? 'Activities' : 'Les activités',
                    item: env.APP_URL + localizedPath('/activites', locale),
                  },
                ]
              : []),
            { '@type': 'ListItem', position: activity ? 3 : 2, name: title, item: canonical },
          ]),
    ],
  };
  const structured = {
    '@context': 'https://schema.org',
    '@graph': [event, organization, breadcrumbs],
  };
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const alternate = bilingual
    ? (['fr-CA', 'en-CA'] as const)
        .map(
          (lang) =>
            '<link rel="alternate" hreflang="' +
            lang +
            '" href="' +
            escape(env.APP_URL + localizedPath(path, lang)) +
            '">',
        )
        .join('')
    : '';
  const tags = `<meta name="description" content="${escape(description)}"><meta name="robots" content="${indexable ? 'index, follow' : 'noindex, nofollow'}"><link rel="canonical" href="${escape(canonical)}">${alternate}<meta property="og:type" content="website"><meta property="og:locale" content="${en ? 'en_CA' : 'fr_CA'}"><meta property="og:title" content="${escape(pageTitle)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:image" content="${escape(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(pageTitle)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${escape(image)}">${indexable ? `<script type="application/ld+json" nonce="${nonce}">${JSON.stringify(structured).replace(/</g, '\\u003c')}</script>` : ''}`;
  const source = await env.ASSETS.fetch(
    new Request(new URL('/index.html', request.url), { headers: request.headers }),
  );
  let html = await source.text();
  html = html
    .replace(/<html(?:\s+lang="[^"]*")?/i, '<html lang="' + locale + '"')
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escape(pageTitle)}</title>`)
    .replace(/<meta\s+(?:name="description"|property="og:[^"]+"|name="twitter:[^"]+")[^>]*>/gi, '')
    .replace('</head>', tags + '</head>');
  if (en && indexable)
    html = html.replace(
      '<div id="root"></div>',
      '<div id="root"><noscript><main><h1>' +
        escape(title) +
        '</h1><p>' +
        escape(description) +
        '</p><a href="/en/activities">Activities</a></main></noscript></div>',
    );
  if (!en && indexable)
    html = html.replace(
      '<div id="root"></div>',
      '<div id="root"><noscript><main><h1>' +
        escape(title) +
        '</h1><p>' +
        escape(description) +
        '</p><p>' +
        escape(path === '/' ? s.story : path === '/cause' ? s.cause : '') +
        '</p><p>Accueil : ' +
        escape(s.reception) +
        ' · Lieu : ' +
        escape(s.location || 'À confirmer') +
        '</p><nav><a href="/activites">Les activités</a> · <a href="/cause">La cause</a> · <a href="/infos">Informations pratiques</a> · <a href="/equipe">L’équipe</a></nav><p>Activez JavaScript pour vous inscrire et accéder à votre compte.</p></main></noscript></div>',
    );
  const headers = new Headers(source.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Content-Language', locale);
  headers.set('Cache-Control', privatePage ? 'no-store' : 'public, max-age=0, must-revalidate');
  headers.delete('etag');
  headers.delete('content-length');
  headers.set(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`,
  );
  if (!indexable) headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(html, { status: known ? 200 : 404, headers });
}
