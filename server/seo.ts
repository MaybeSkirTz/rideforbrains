import type { Env } from './types';
import { parse } from './types';
import { calendarICS } from '../shared/event';
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
  '/velo': ['Vélo 100 km', 'Une sortie à vélo de 100 km pour Ride For Brains.'],
  '/course': ['Course 10, 5 et 2 km', 'Choisissez votre distance de course pour Ride For Brains.'],
  '/marche': ['Marche 5 km', 'Cinq kilomètres à pied pour se retrouver.'],
  '/cause': [
    'La cause',
    'Découvrez la cause et faites un don séparément sur la plateforme officielle de Brain Canada.',
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
  '/benevoles': ['Devenir bénévole', 'Proposez votre aide pour Ride For Brains.'],
  '/partenaires': ['Devenir partenaire', 'Contactez l’organisation pour soutenir l’événement.'],
};
export async function publicDocument(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url),
    originalPath = url.pathname;
  const aliases: Record<string, string> = {
    '/benevolat': '/benevoles',
    '/parcours': '/infos',
    '/annulation': '/conditions',
  };
  const path = aliases[originalPath] || originalPath;
  if (path === '/robots.txt')
    return new Response(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /connexion\nDisallow: /compte\nDisallow: /espace\nDisallow: /inscription\nDisallow: /billet/\nDisallow: /transfert\nSitemap: ${env.APP_URL}/sitemap.xml\n`,
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  const htmlPage = path === '/' || !path.split('/').pop()?.includes('.');
  if (!htmlPage && !['/sitemap.xml', '/calendrier.ics'].includes(path))
    return env.ASSETS.fetch(request);
  const s = parse(
    (await env.DB.prepare('SELECT data FROM settings WHERE id=1').first<any>())?.data,
  );
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
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        [...Object.keys(pages), ...activities.map((a) => '/activites/' + a.id)]
          .map((p) => '<url><loc>' + escape(env.APP_URL + p) + '</loc></url>')
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
    /^\/(admin|api|connexion|compte|espace|inscription|attente|billet|transfert|desabonnement|courriels-locaux)(\/|$)/.test(
      path,
    );
  const known =
    !!pages[path] ||
    !!activity ||
    privatePage ||
    ['/conditions', '/confidentialite'].includes(path);
  const price = activity
    ? new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(
        activity.price / 100,
      )
    : '';
  const date = new Intl.DateTimeFormat('fr-CA', {
    dateStyle: 'long',
    timeZone: 'America/Toronto',
  }).format(new Date(s.eventAt));
  const title = activity
    ? `${({ velo: 'Vélo', course: 'Course', marche: 'Marche' } as any)[activity.sport]} · ${activity.name} · ${activity.distance} · ${price}`
    : pages[path]?.[0] || 'Ride For Brains';
  const description = activity
    ? `${activity.name}, ${activity.distance}, le ${date}. ${price} CAD par participation. Réservé aux 18 ans et plus. Frais d’inscription distincts des dons.`
    : `${pages[path]?.[1] || 'Ride For Brains.'} ${s.edition} · ${date} · Accueil à ${s.reception.replace(':', ' h ')}.`;
  const canonical = env.APP_URL + path,
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
    description,
    startDate: s.eventAt,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: env.APP_URL,
    image: [image],
    ...(s.location ? { location: { '@type': 'Place', name: s.location } } : {}),
    offers: activities.map((a) => ({
      '@type': 'Offer',
      name: a.name + ' ' + a.distance,
      price: (a.price / 100).toFixed(2),
      priceCurrency: 'CAD',
      url: env.APP_URL + '/activites/' + a.id,
    })),
  };
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const tags = `<meta name="description" content="${escape(description)}"><meta name="robots" content="${privatePage || !known ? 'noindex, nofollow' : 'index, follow'}"><link rel="canonical" href="${escape(canonical)}"><meta property="og:type" content="website"><meta property="og:locale" content="fr_CA"><meta property="og:title" content="${escape(title)} — Ride For Brains"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:image" content="${escape(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${escape(image)}">${!privatePage && known ? `<script type="application/ld+json" nonce="${nonce}">${JSON.stringify(event).replace(/</g, '\\u003c')}</script>` : ''}`;
  const source = await env.ASSETS.fetch(
    new Request(new URL('/index.html', request.url), { headers: request.headers }),
  );
  let html = await source.text();
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escape(title)} — Ride For Brains</title>`)
    .replace(/<meta\s+(?:name="description"|property="og:[^"]+"|name="twitter:[^"]+")[^>]*>/gi, '')
    .replace('</head>', tags + '</head>');
  if (!privatePage && known)
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
  headers.set('Cache-Control', privatePage ? 'no-store' : 'public, max-age=0, must-revalidate');
  headers.delete('etag');
  headers.delete('content-length');
  headers.set(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`,
  );
  if (privatePage || !known) headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(html, { status: known ? 200 : 404, headers });
}
