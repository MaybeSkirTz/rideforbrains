import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Settings2,
  ListChecks,
  Mail,
  ScanLine,
  Inbox,
  ShieldCheck,
  ScrollText,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Download,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Camera,
  X,
  Check,
  Search,
  Eye,
} from 'lucide-react';
import { useApp, Page, Link, Button, Field, Notice, DynamicFields } from './main';
import { api, money, statuses, date } from './api';

type Feedback = {
  error: string;
  message: string;
  setError: (s: string) => void;
  setMessage: (s: string) => void;
};
export default function Admin() {
  const { user } = useApp();
  const [tab, setTab] = useState('overview'),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [selected, setSelected] = useState<string[]>([]);
  const feedback = { error, message, setError, setMessage };
  if (!user)
    return (
      <Page eyebrow="ÉQUIPE RIDE FOR BRAINS" title="L’espace de l’organisation.">
        <Link className="button" to="/connexion">
          Me connecter <ArrowRight size={17} />
        </Link>
      </Page>
    );
  if (user.role === 'participant')
    return (
      <Page eyebrow="ACCÈS RÉSERVÉ" title="Cet espace est réservé à l’équipe.">
        <p>Un administrateur doit accorder les permissions à votre compte.</p>
        <Link className="button" to="/espace">
          Revenir à mon espace
        </Link>
      </Page>
    );
  const has = (permission: string) =>
    user.role === 'admin' ||
    user.permissions.includes(permission) ||
    (user.role === 'checkin' && permission === 'checkin');
  const tabs = [
    ['overview', 'Vue d’ensemble', LayoutDashboard, 'participants'],
    ['participants', 'Participants', Users, 'participants'],
    ['settings', 'Événement', Settings2, 'event'],
    ['forms', 'Formulaires', ListChecks, 'event'],
    ['mail', 'Communications', Mail, 'communications'],
    ['checkin', 'Accueil / QR', ScanLine, 'checkin'],
    ['submissions', 'Demandes reçues', Inbox, 'submissions'],
    ['staff', 'Équipe et accès', ShieldCheck, 'staff'],
    ['audit', 'Journal d’audit', ScrollText, 'staff'],
  ] as const;
  const active =
    tabs.find((t) => t[0] === tab && has(t[3]))?.[0] || tabs.find((t) => has(t[3]))?.[0];
  return (
    <div className="admin-page">
      <div className="admin-top">
        <div>
          <p className="eyebrow">ÉQUIPE RIDE FOR BRAINS</p>
          <h1>De l’élan à l’organisation.</h1>
          <p>
            {user.name} ·{' '}
            {user.role === 'admin'
              ? 'Administrateur principal'
              : user.role === 'checkin'
                ? 'Bénévole d’accueil'
                : 'Organisateur'}
          </p>
        </div>
        <Link to="/" className="text-link">
          Voir le site <ArrowUpRight size={17} />
        </Link>
      </div>
      <div className="admin-shell">
        <nav className="admin-nav" aria-label="Administration">
          {tabs
            .filter((t) => has(t[3]))
            .map(([key, label, Icon]) => (
              <button
                className={active === key ? 'selected' : ''}
                key={key}
                onClick={() => {
                  setTab(key);
                  setError('');
                  setMessage('');
                }}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
        </nav>
        <section className="admin-content" aria-label="Contenu de l’administration">
          {error && <Notice error>{error}</Notice>}
          {message && <Notice>{message}</Notice>}
          {active === 'overview' ? (
            <Overview {...feedback} />
          ) : active === 'participants' ? (
            <Participants
              {...feedback}
              selected={selected}
              setSelected={setSelected}
              compose={() => setTab('mail')}
              canExport={has('export')}
              canRefund={has('refunds')}
              canMail={has('communications')}
            />
          ) : active === 'settings' ? (
            <Settings {...feedback} />
          ) : active === 'forms' ? (
            <Forms {...feedback} />
          ) : active === 'mail' ? (
            <Communications {...feedback} selected={selected} />
          ) : active === 'checkin' ? (
            <Checkin {...feedback} canUndo={has('participants')} />
          ) : active === 'submissions' ? (
            <Submissions {...feedback} />
          ) : active === 'staff' ? (
            <Staff {...feedback} />
          ) : active === 'audit' ? (
            <Audit {...feedback} />
          ) : (
            <p>Aucune permission accordée.</p>
          )}
        </section>
      </div>
    </div>
  );
}
function useLoad(path: string, setError: (s: string) => void) {
  const [data, setData] = useState<any>(null);
  const load = () =>
    api(path)
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, [path]);
  return [data, load, setData] as const;
}
function Overview({ setError }: Feedback) {
  const [data, load] = useLoad('/admin/overview', setError);
  if (!data) return <p>Chargement des données…</p>;
  const count = (status: string) =>
    data.stats
      .filter((r: any) => r.status === status)
      .reduce((s: number, r: any) => s + r.count, 0);
  const present = data.stats.reduce((s: number, r: any) => s + (r.present || 0), 0);
  return (
    <>
      <div className="admin-toolbar">
        <h2>Votre événement en direct</h2>
        <Button onClick={load}>Actualiser</Button>
      </div>
      <div className="metric-grid">
        <Metric
          title="Inscriptions confirmées"
          value={count('confirmed') + count('partially_refunded')}
        />
        <Metric title="Recettes d’inscription reçues" value={money(data.money.received)} />
        <Metric title="Remboursements effectués" value={money(data.money.refunded)} />
        <Metric title="Présences à l’accueil" value={present} />
        <Metric title="Paiements en attente (actifs)" value={money(data.money.pending)} />
        <Metric title="Liste d’attente" value={count('waitlisted')} />
        <Metric title="Paiements à vérifier" value={count('paid_review')} />
        <Metric
          title="Recettes nettes des remboursements*"
          value={money(data.money.received - data.money.refunded)}
        />
      </div>
      <p className="admin-cause-note">
        * Avant frais de traitement. Les dons versés à Brain Canada ne sont pas comptabilisés ici.
      </p>
      {data.alerts.length > 0 && (
        <Notice error>
          {data.alerts.length} dossier(s) ou envoi(s) nécessitent une intervention.
          {data.alerts.map((r: any) => (
            <p key={r.id}>
              {r.id.slice(0, 8)} · {statuses[r.status] || r.status}
            </p>
          ))}
        </Notice>
      )}
      <h3>Par activité et statut</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Activité</th>
              <th>Statut</th>
              <th>Inscriptions</th>
              <th>Quota</th>
            </tr>
          </thead>
          <tbody>
            {data.stats.map((r: any, i: number) => (
              <tr key={i}>
                <td>
                  {r.name} · {r.distance}
                </td>
                <td>{statuses[r.status] || 'Aucune inscription'}</td>
                <td>{r.count}</td>
                <td>{r.capacity ?? 'Illimité'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function Metric({ title, value }: any) {
  return (
    <div className="metric">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Participants(
  props: Feedback & {
    selected: string[];
    setSelected: (s: string[]) => void;
    compose: () => void;
    canExport: boolean;
    canRefund: boolean;
    canMail: boolean;
  },
) {
  const { setError, setMessage, selected, setSelected, compose, canExport, canRefund, canMail } =
    props;
  const { data } = useApp();
  const [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [activity, setActivity] = useState(''),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(''),
    [detail, setDetail] = useState<any>(null);
  const [rows, load] = useLoad('/admin/participants?page=' + page + query, setError);
  const filter = (e: any) => {
    e.preventDefault();
    setPage(1);
    setQuery('&q=' + encodeURIComponent(q) + '&status=' + status + '&activity=' + activity);
  };
  const open = async (id: string) => {
    setError('');
    try {
      setDetail(await api('/admin/participants/' + id));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const save = async (e: any) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api('/admin/participants/' + detail.id, Object.fromEntries(f), 'PATCH');
      setMessage('Dossier mis à jour.');
      await open(detail.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <div className="admin-toolbar">
        <h2>Les participants</h2>
        {canExport && (
          <a href="/api/admin/export" className="button">
            Exporter CSV <Download size={15} />
          </a>
        )}
      </div>
      <form onSubmit={filter} className="admin-filters">
        <Field label="Rechercher">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nom, courriel, numéro…"
          />
        </Field>
        <Field label="Statut">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous les statuts</option>
            {[
              'pending',
              'confirmed',
              'expired',
              'paid_review',
              'waitlisted',
              'cancelled',
              'refunding',
              'partially_refunded',
              'refunded',
            ].map((k) => (
              <option key={k} value={k}>
                {statuses[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Activité">
          <select value={activity} onChange={(e) => setActivity(e.target.value)}>
            <option value="">Toutes les activités</option>
            {data.activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.distance}
              </option>
            ))}
          </select>
        </Field>
        <Button>
          Filtrer <Search size={14} />
        </Button>
      </form>
      {selected.length > 0 && (
        <div className="actions">
          <span className="small">{selected.length} participation(s) sélectionnée(s)</span>
          {canMail && (
            <Button onClick={compose}>
              Écrire à la sélection <Mail size={15} />
            </Button>
          )}
          <button className="text-link" onClick={() => setSelected([])}>
            Effacer la sélection
          </button>
        </div>
      )}
      {rows && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Sélectionner cette page"
                      checked={
                        rows.rows.length > 0 && rows.rows.every((r: any) => selected.includes(r.id))
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...new Set([...selected, ...rows.rows.map((r: any) => r.id)])]
                            : selected.filter((id) => !rows.rows.some((r: any) => r.id === id)),
                        )
                      }
                    />
                  </th>
                  <th>Participant</th>
                  <th>Activité</th>
                  <th>Statut</th>
                  <th>Prix</th>
                  <th>Présence</th>
                </tr>
              </thead>
              <tbody>
                {rows.rows.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={'Sélectionner ' + r.first_name + ' ' + r.last_name}
                        checked={selected.includes(r.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, r.id]
                              : selected.filter((id) => id !== r.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <button className="text-link" onClick={() => open(r.id)}>
                        {r.first_name} {r.last_name} <ArrowUpRight size={13} />
                      </button>
                      <br />
                      <span className="small">{r.email}</span>
                    </td>
                    <td>
                      {r.name} · {r.distance}
                    </td>
                    <td>
                      <span className={'status ' + r.status}>{statuses[r.status]}</span>
                    </td>
                    <td>{money(r.price)}</td>
                    <td>{r.checked_at ? 'Présent' : '—'}</td>
                  </tr>
                ))}
                {!rows.rows.length && (
                  <tr>
                    <td colSpan={6}>Aucun dossier trouvé.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ArrowLeft size={14} />
              Précédent
            </Button>
            <span>
              {rows.total} résultat(s) · page {page}
            </span>
            <Button disabled={page * 30 >= rows.total} onClick={() => setPage(page + 1)}>
              Suivant <ArrowRight size={14} />
            </Button>
          </div>
        </>
      )}
      {detail && (
        <section className="detail-panel">
          <header>
            <div>
              <p className="eyebrow">DOSSIER {detail.id.slice(0, 8)}</p>
              <h2>
                {detail.first_name} {detail.last_name}
              </h2>
            </div>
            <button
              className="icon-button"
              onClick={() => setDetail(null)}
              aria-label="Fermer le dossier"
            >
              <X size={20} />
            </button>
          </header>
          <p className="small">
            {detail.email} · commande {detail.order_id}
          </p>
          <span className={'status ' + detail.status}>{statuses[detail.status]}</span>
          <form onSubmit={save} className="admin-section">
            <div className="form-grid">
              {[
                ['first_name', 'Prénom'],
                ['last_name', 'Nom'],
                ['phone', 'Téléphone'],
                ['emergency_name', 'Contact d’urgence'],
                ['emergency_phone', 'Téléphone d’urgence'],
              ].map(([k, label]) => (
                <Field key={k} label={label}>
                  <input name={k} defaultValue={detail[k]} required key={detail.id + k} />
                </Field>
              ))}
            </div>
            <Field label="Notes internes">
              <textarea
                name="notes"
                rows={3}
                defaultValue={detail.notes}
                key={detail.id + 'notes'}
                maxLength={6000}
              />
            </Field>
            <Button>Enregistrer le dossier</Button>
          </form>
          <div className="admin-section">
            <h3>Réponses au formulaire · version {detail.form_version}</h3>
            <dl>
              {detail.fields.map((f: any) => (
                <React.Fragment key={f.id}>
                  <dt>{f.label}</dt>
                  <dd>{String(detail.answers[f.id] ?? '—')}</dd>
                </React.Fragment>
              ))}
            </dl>
            <p className="small">
              Conditions acceptées le {date(detail.accepted_at)} · {detail.conditions_version}
              <br />
              Photos : {detail.photo ? 'Oui' : 'Non'} · Promotions :{' '}
              {detail.marketing ? 'Oui' : 'Non'}
            </p>
            <details>
              <summary>Voir les conditions acceptées</summary>
              <p className="small prewrap">{detail.conditions_snapshot}</p>
            </details>
          </div>
          <div className="admin-section">
            <h3>Historique des statuts</h3>
            {detail.history.map((h: any) => (
              <p className="small" key={h.id}>
                {date(h.at)} · {statuses[h.status]}
              </p>
            ))}
          </div>
          {canMail && (
            <div className="actions">
              <Button
                onClick={() => {
                  setSelected([detail.id]);
                  compose();
                }}
              >
                Écrire à cette personne <Mail size={15} />
              </Button>
              <button
                className="text-link"
                onClick={async () => {
                  try {
                    const x = await api('/admin/resend/' + detail.id, {});
                    setMessage(
                      x.status === 'development'
                        ? 'Confirmation conservée dans la boîte locale.'
                        : 'Confirmation ajoutée à la file d’envoi.',
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Renvoyer la confirmation
              </button>
            </div>
          )}
          {canRefund && detail.order.payment_intent && (
            <form
              className="admin-section"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const amount = Math.round(Number(f.get('amount')) * 100);
                if (
                  !confirm(`Demander un remboursement de ${money(amount)} sur le dossier complet?`)
                )
                  return;
                try {
                  await api('/admin/refunds', {
                    orderId: detail.order_id,
                    amount,
                    reason: f.get('reason'),
                    confirm: true,
                  });
                  setMessage('Remboursement ajouté à la file. Le statut final dépend de Stripe.');
                  await open(detail.id);
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <h3>Remboursement du dossier</h3>
              <p className="small">
                Commande : {money(detail.order.amount)} · déjà remboursé :{' '}
                {money(detail.order.refunded)}. Le remboursement concerne la commande, qui peut
                inclure plusieurs personnes.
              </p>
              <div className="form-grid">
                <Field label="Montant en dollars CA">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={(detail.order.amount - detail.order.refunded) / 100}
                    defaultValue={(detail.order.amount - detail.order.refunded) / 100}
                    name="amount"
                    required
                  />
                </Field>
                <Field label="Motif (journalisé)">
                  <input name="reason" minLength={5} maxLength={500} required />
                </Field>
              </div>
              <Button>Demander le remboursement</Button>
            </form>
          )}
        </section>
      )}
    </>
  );
}

function Settings({ setError, setMessage }: Feedback) {
  const { refresh } = useApp();
  const [config, load, setConfig] = useLoad('/admin/config', setError);
  const [busy, setBusy] = useState(false);
  if (!config) return <p>Chargement des réglages…</p>;
  const s = config.settings;
  const change = (k: string, v: any) => setConfig({ ...config, settings: { ...s, [k]: v } });
  const save = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/admin/settings', { settings: s, revision: config.revision }, 'PUT');
      setMessage('Les réglages sont enregistrés.');
      await load();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <h2>Tout l’événement, ici.</h2>
      <form onSubmit={save} className="form-panel">
        <h3>L’essentiel</h3>
        <div className="form-grid">
          <Field label="Nom">
            <input value={s.title} onChange={(e) => change('title', e.target.value)} required />
          </Field>
          <Field label="Édition">
            <input value={s.edition} onChange={(e) => change('edition', e.target.value)} required />
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={s.date}
              onChange={(e) => change('date', e.target.value)}
              required
            />
          </Field>
          <Field
            label="Début exact de l’événement (avec fuseau)"
            hint="Sert au calcul du remboursement : 15 jours exactement."
          >
            <input value={s.eventAt} onChange={(e) => change('eventAt', e.target.value)} required />
          </Field>
          <Field label="Ouverture de l’accueil">
            <input
              type="time"
              value={s.reception}
              onChange={(e) => change('reception', e.target.value)}
              required
            />
          </Field>
          <Field label="Fermeture de l’accueil (à confirmer si vide)">
            <input
              value={s.closing || ''}
              onChange={(e) => change('closing', e.target.value || null)}
            />
          </Field>
          <Field label="Lieu de départ">
            <input
              value={s.location || ''}
              onChange={(e) => change('location', e.target.value || null)}
              placeholder="À confirmer"
            />
          </Field>
          <Field label="Courriel de contact">
            <input
              type="email"
              value={s.contact}
              onChange={(e) => change('contact', e.target.value)}
              required
            />
          </Field>
        </div>
        <Field label="Lien de collecte Brain Canada">
          <input
            type="url"
            value={s.donationUrl}
            onChange={(e) => change('donationUrl', e.target.value)}
            required
          />
        </Field>
        <h3>Ouverture et fiscalité</h3>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={s.registrationOpen}
            onChange={(e) => change('registrationOpen', e.target.checked)}
          />
          Ouvrir les inscriptions (la production exige aussi les services et validations).
        </label>
        <div className="form-grid">
          <DateTimeField
            label="Ouverture programmée"
            value={s.salesOpenAt}
            change={(v: any) => change('salesOpenAt', v)}
          />
          <DateTimeField
            label="Fermeture programmée"
            value={s.salesCloseAt}
            change={(v: any) => change('salesCloseAt', v)}
          />
        </div>
        <Field label="Traitement fiscal validé par l’organisation">
          <select value={s.taxMode} onChange={(e) => change('taxMode', e.target.value)}>
            <option value="unconfirmed">À valider — paiements réels fermés</option>
            <option value="included">Taxes incluses dans le prix affiché</option>
            <option value="not_applicable">Taxes non applicables</option>
          </select>
        </Field>
        <p className="small">
          Le site n’ajoute pas de frais au participant. Faites valider le traitement fiscal avant de
          choisir une option. La règle actuelle réserve les activités aux 18 ans et plus.
        </p>
        <details className="settings-details">
          <summary>Contenus, FAQ, galerie et partenaires</summary>
          <Field label="Notre histoire">
            <textarea rows={4} value={s.story} onChange={(e) => change('story', e.target.value)} />
          </Field>
          <Field label="Texte sur la cause">
            <textarea rows={4} value={s.cause} onChange={(e) => change('cause', e.target.value)} />
          </Field>
          <JsonField
            label="Questions fréquentes"
            hint='Tableau de { "q": "Question", "a": "Réponse" }'
            value={s.faq}
            change={(v: any) => change('faq', v)}
          />
          <JsonField
            label="Photos réelles de l’événement"
            hint='Tableau de { "url": "https://…", "alt": "Description" }. Publiez uniquement les photos autorisées.'
            value={s.photos}
            change={(v: any) => change('photos', v)}
          />
          <JsonField
            label="Partenaires validés"
            hint='Tableau de { "name": "Nom", "url": "https://…", "logo": "https://…" }'
            value={s.partners}
            change={(v: any) => change('partners', v)}
          />
        </details>
        <details className="settings-details">
          <summary>Conditions, confidentialité et validations</summary>
          <Field label="Version des conditions (à changer pour chaque modification)">
            <input
              value={s.termsVersion}
              onChange={(e) => change('termsVersion', e.target.value)}
              required
            />
          </Field>
          <Field label="Conditions d’inscription">
            <textarea
              rows={9}
              value={s.terms}
              onChange={(e) => change('terms', e.target.value)}
              required
            />
          </Field>
          <Field label="Confidentialité">
            <textarea
              rows={9}
              value={s.privacy}
              onChange={(e) => change('privacy', e.target.value)}
              required
            />
          </Field>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={s.legalApproved}
              onChange={(e) => change('legalApproved', e.target.checked)}
            />
            Les textes et modalités ont été validés pour l’ouverture.
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={s.brandApproved}
              onChange={(e) => change('brandApproved', e.target.checked)}
            />
            La présentation de Brain Canada et les usages de marque ont été validés.
          </label>
          <p className="small">
            Règle fixée : remboursement complet à 15 jours ou plus, puis aucun remboursement.
            Définir aussi les modalités d’annulation ou de report par l’organisation dans les
            conditions.
          </p>
        </details>
        <details className="settings-details">
          <summary>Modifications autorisées aux participants</summary>
          {[
            ['phone', 'Téléphone'],
            ['emergency_name', 'Nom du contact d’urgence'],
            ['emergency_phone', 'Téléphone d’urgence'],
          ].map(([k, l]) => (
            <label className="checkbox" key={k}>
              <input
                type="checkbox"
                checked={s.editableFields.includes(k)}
                onChange={(e) =>
                  change(
                    'editableFields',
                    e.target.checked
                      ? [...s.editableFields, k]
                      : s.editableFields.filter((v: string) => v !== k),
                  )
                }
              />
              {l}
            </label>
          ))}
        </details>
        <div className="actions">
          <Button busy={busy}>
            Enregistrer les réglages <Check size={16} />
          </Button>
        </div>
      </form>
      <section className="admin-section">
        <h3>Activités, tarifs, quotas et parcours</h3>
        {config.activities.map((a: any) => (
          <ActivityEditor
            key={a.id + ':' + a.price + ':' + a.capacity}
            activity={a}
            setError={setError}
            saved={async () => {
              setMessage('Activité mise à jour.');
              await load();
              await refresh();
            }}
          />
        ))}
      </section>
      <Promos config={config} reload={load} setError={setError} setMessage={setMessage} />
    </>
  );
}
function DateTimeField({ label, value, change }: any) {
  const local = value
    ? new Date(value * 1000 - new Date(value * 1000).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : '';
  return (
    <Field
      label={label}
      hint="Heure locale du navigateur. Laissez vide pour ne pas imposer de date."
    >
      <input
        type="datetime-local"
        value={local}
        onChange={(e) =>
          change(e.target.value ? Math.floor(new Date(e.target.value).getTime() / 1000) : null)
        }
      />
    </Field>
  );
}
function JsonField({ label, hint, value, change }: any) {
  const [text, setText] = useState(JSON.stringify(value, null, 2)),
    [error, setError] = useState('');
  return (
    <Field label={label} hint={hint}>
      <textarea
        className="json-editor"
        rows={6}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            change(JSON.parse(e.target.value));
            setError('');
          } catch {
            setError('JSON invalide : la dernière version valide reste conservée.');
          }
        }}
        aria-invalid={!!error}
      />
      {error && <small role="alert">{error}</small>}
    </Field>
  );
}
function ActivityEditor({ activity, saved, setError }: any) {
  const [a, setA] = useState({ ...activity }),
    [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setA((old: any) => ({ ...old, [k]: v }));
  return (
    <details className="settings-details">
      <summary>
        {a.name} · {a.distance} · {money(a.price)} · {a.capacity ?? 'sans limite'} participants
      </summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const { form_version, ...body } = a;
            await api('/admin/activities', body, 'PUT');
            await saved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Nom de l’activité">
            <input value={a.name} onChange={(e) => set('name', e.target.value)} required />
          </Field>
          <Field label="Distance affichée">
            <input value={a.distance} onChange={(e) => set('distance', e.target.value)} required />
          </Field>
          <Field label="Tarif en dollars CA">
            <input
              type="number"
              min="0"
              step="0.01"
              value={a.price / 100}
              onChange={(e) => set('price', Math.round(Number(e.target.value) * 100))}
              required
            />
          </Field>
          <Field label="Quota (vide = illimité)">
            <input
              type="number"
              min="1"
              value={a.capacity ?? ''}
              onChange={(e) => set('capacity', e.target.value ? Number(e.target.value) : null)}
            />
          </Field>
          <DateTimeField
            label="Début des ventes"
            value={a.opens_at}
            change={(v: any) => set('opens_at', v)}
          />
          <DateTimeField
            label="Fin des ventes"
            value={a.closes_at}
            change={(v: any) => set('closes_at', v)}
          />
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={!!a.enabled}
            onChange={(e) => set('enabled', e.target.checked ? 1 : 0)}
          />
          Activité visible et disponible
        </label>
        <Field label="Description du parcours">
          <textarea
            rows={3}
            value={a.route.description || ''}
            onChange={(e) => set('route', { ...a.route, description: e.target.value })}
          />
        </Field>
        {[
          ['mapUrl', 'Lien vers la carte'],
          ['gpxUrl', 'Lien de téléchargement GPX'],
        ].map(([k, l]) => (
          <Field label={l} key={k}>
            <input
              type="url"
              value={a.route[k] || ''}
              onChange={(e) => {
                const route = { ...a.route };
                if (e.target.value) route[k] = e.target.value;
                else delete route[k];
                set('route', route);
              }}
            />
          </Field>
        ))}
        <Field label="Points de ravitaillement (un par ligne)">
          <textarea
            rows={3}
            value={(a.route.supplies || []).join('\n')}
            onChange={(e) =>
              set('route', { ...a.route, supplies: e.target.value.split('\n').filter(Boolean) })
            }
          />
        </Field>
        <Button busy={busy}>Enregistrer cette activité</Button>
      </form>
    </details>
  );
}
function Promos({ config, reload, setError, setMessage }: any) {
  return (
    <section className="admin-section">
      <h3>Codes promotionnels</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Réduction</th>
              <th>Limite</th>
              <th>Actif</th>
            </tr>
          </thead>
          <tbody>
            {config.promos.map((p: any) => (
              <tr key={p.code}>
                <td>{p.code}</td>
                <td>{p.percent} %</td>
                <td>{p.max_uses ?? 'Illimitée'}</td>
                <td>{p.active ? 'Oui' : 'Non'}</td>
              </tr>
            ))}
            {!config.promos.length && (
              <tr>
                <td colSpan={4}>Aucun code promotionnel.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <form
        className="form-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            await api(
              '/admin/promos',
              {
                code: String(f.get('code')).toUpperCase(),
                percent: Number(f.get('percent')),
                maxUses: f.get('limit') ? Number(f.get('limit')) : null,
                expiresAt: f.get('expiry')
                  ? Math.floor(new Date(String(f.get('expiry'))).getTime() / 1000)
                  : null,
                active: f.get('active') === 'on',
              },
              'PUT',
            );
            setMessage('Code promotionnel enregistré.');
            await reload();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Code (existant pour le modifier)">
            <input name="code" required pattern="[A-Za-z0-9_-]{2,40}" />
          </Field>
          <Field label="Réduction en %">
            <input name="percent" type="number" min="1" max="100" required />
          </Field>
          <Field label="Nombre maximal de commandes (vide = illimité)">
            <input name="limit" type="number" min="1" />
          </Field>
          <Field label="Expiration">
            <input name="expiry" type="datetime-local" />
          </Field>
        </div>
        <label className="checkbox">
          <input type="checkbox" name="active" defaultChecked />
          Code actif
        </label>
        <Button>Enregistrer ce code</Button>
      </form>
    </section>
  );
}

function Forms({ setError, setMessage }: Feedback) {
  const { refresh } = useApp();
  const [config, load] = useLoad('/admin/config', setError);
  const [activity, setActivity] = useState(''),
    [fields, setFields] = useState<any[]>([]),
    [version, setVersion] = useState(0),
    [answers, setAnswers] = useState({}),
    [busy, setBusy] = useState(false);
  const select = (id: string) => {
    setActivity(id);
    const a = config.activities.find((a: any) => a.id === id);
    setVersion(a.form_version);
    setFields(
      structuredClone(
        config.forms.find((f: any) => f.activity_id === id && f.version === a.form_version).fields,
      ),
    );
    setAnswers({});
  };
  const field = (i: number, k: string, v: any) =>
    setFields((fs) => fs.map((f, n) => (i === n ? { ...f, [k]: v } : f)));
  if (!config) return <p>Chargement des formulaires…</p>;
  return (
    <>
      <h2>Des questions adaptées à chaque activité.</h2>
      <Field label="Choisir le formulaire">
        <select value={activity} onChange={(e) => select(e.target.value)}>
          <option value="">Choisir une activité</option>
          {config.activities.map((a: any) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.distance}
            </option>
          ))}
        </select>
      </Field>
      {activity && (
        <>
          <p className="small">
            Version publiée : {version}. Publier une nouvelle version conserve intégralement les
            réponses et formulaires des inscriptions précédentes.
          </p>
          {fields.map((f, i) => (
            <div className="form-panel" key={i} style={{ marginBottom: 18 }}>
              <div className="admin-toolbar">
                <h3>Question {i + 1}</h3>
                <div className="actions" style={{ marginTop: 0, gap: 8 }}>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Monter la question"
                    disabled={i === 0}
                    onClick={() => {
                      const fs = [...fields];
                      [fs[i - 1], fs[i]] = [fs[i], fs[i - 1]];
                      setFields(fs);
                    }}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Descendre la question"
                    disabled={i === fields.length - 1}
                    onClick={() => {
                      const fs = [...fields];
                      [fs[i + 1], fs[i]] = [fs[i], fs[i + 1]];
                      setFields(fs);
                    }}
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Retirer la question"
                    onClick={() => setFields((fs) => fs.filter((_, n) => n !== i))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Identifiant stable">
                  <input
                    value={f.id}
                    onChange={(e) => field(i, 'id', e.target.value)}
                    pattern="[a-z][a-z0-9_]*"
                  />
                </Field>
                <Field label="Type">
                  <select value={f.type} onChange={(e) => field(i, 'type', e.target.value)}>
                    <option value="text">Texte</option>
                    <option value="select">Liste de choix</option>
                    <option value="checkbox">Case à cocher</option>
                  </select>
                </Field>
              </div>
              <Field label="Libellé">
                <input value={f.label} onChange={(e) => field(i, 'label', e.target.value)} />
              </Field>
              {f.type === 'select' && (
                <Field label="Choix (un par ligne)">
                  <textarea
                    rows={4}
                    value={(f.options || []).join('\n')}
                    onChange={(e) => field(i, 'options', e.target.value.split('\n'))}
                  />
                </Field>
              )}
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) => field(i, 'required', e.target.checked)}
                />
                Réponse obligatoire
              </label>
              <details>
                <summary>Condition d’affichage</summary>
                <Field label="Afficher seulement si la question…">
                  <select
                    value={f.showWhen?.field || ''}
                    onChange={(e) => {
                      if (e.target.value)
                        field(i, 'showWhen', { field: e.target.value, equals: '' });
                      else {
                        const fs = [...fields];
                        delete fs[i].showWhen;
                        setFields(fs);
                      }
                    }}
                  >
                    <option value="">Toujours afficher</option>
                    {fields
                      .filter((_, n) => n !== i)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.label}
                        </option>
                      ))}
                  </select>
                </Field>
                {f.showWhen && (
                  <Field label="… a exactement cette valeur">
                    <input
                      value={String(f.showWhen.equals)}
                      onChange={(e) =>
                        field(i, 'showWhen', {
                          ...f.showWhen,
                          equals:
                            e.target.value === 'true'
                              ? true
                              : e.target.value === 'false'
                                ? false
                                : e.target.value,
                        })
                      }
                    />
                  </Field>
                )}
              </details>
            </div>
          ))}
          <Button
            className="outline"
            onClick={() =>
              setFields((fs) => [
                ...fs,
                {
                  id: 'question_' + (fs.length + 1),
                  label: 'Nouvelle question',
                  type: 'text',
                  required: false,
                },
              ])
            }
          >
            <Plus size={16} />
            Ajouter une question
          </Button>
          <section className="admin-section">
            <h3>Aperçu avant publication</h3>
            <div className="form-panel">
              <DynamicFields fields={fields} answers={answers} onChange={setAnswers} />
            </div>
            <div className="actions">
              <Button
                busy={busy}
                onClick={async () => {
                  if (!confirm('Publier la version ' + (version + 1) + ' de ce formulaire?'))
                    return;
                  setBusy(true);
                  try {
                    const r = await api('/admin/forms', {
                      activityId: activity,
                      expectedVersion: version,
                      fields,
                    });
                    setVersion(r.version);
                    setMessage('Nouvelle version publiée. Les anciennes réponses sont conservées.');
                    await load();
                    await refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Publier la version {version + 1} <Check size={16} />
              </Button>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function Communications({ setError, setMessage, selected }: Feedback & { selected: string[] }) {
  const { data } = useApp();
  const [rows, load] = useLoad('/admin/mail', setError);
  const [templates, reloadTemplates] = useLoad('/admin/templates', setError);
  const [templateId, setTemplateId] = useState(''),
    [templateName, setTemplateName] = useState('Message de l’organisation');
  const [target, setTarget] = useState(selected.length ? 'selection' : 'all'),
    [activity, setActivity] = useState(data.activities[0]?.id || ''),
    [kind, setKind] = useState('operational'),
    [subject, setSubject] = useState('Informations pour votre participation à Ride For Brains'),
    [body, setBody] = useState(
      'Bonjour {{prenom}},\n\nVoici les informations pour votre activité {{activite}}.\nVotre numéro d’inscription : {{numero}}\n\nÀ bientôt,\nL’équipe Ride For Brains',
    ),
    [preview, setPreview] = useState<any>(null),
    [campaign, setCampaign] = useState(crypto.randomUUID()),
    [schedule, setSchedule] = useState(''),
    [busy, setBusy] = useState(false);
  const input = () => ({
    ...(target === 'selection'
      ? { ids: selected }
      : target === 'activity'
        ? { activityId: activity }
        : {}),
    kind,
    subject,
    body,
    campaign,
    availableAt: schedule ? Math.floor(new Date(schedule).getTime() / 1000) : undefined,
  });
  const invalidate = () => setPreview(null);
  return (
    <>
      <h2>Des nouvelles de l’organisation.</h2>
      <p className="small">
        Les messages opérationnels servent à gérer l’événement. Les messages promotionnels sont
        réservés aux personnes ayant consenti et incluent un désabonnement.
      </p>
      <div className="form-grid">
        <Field label="Modèle partagé avec l’équipe">
          <select
            value={templateId}
            onChange={(e) => {
              const t = templates?.find((t: any) => t.id === e.target.value);
              setTemplateId(e.target.value);
              if (t) {
                setTemplateName(t.name);
                setSubject(t.subject);
                setBody(t.body);
                setKind(t.kind);
                invalidate();
              }
            }}
          >
            <option value="">Nouveau modèle</option>
            {templates?.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nom du modèle">
          <input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            maxLength={100}
          />
        </Field>
      </div>
      <form
        className="form-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          setBusy(true);
          try {
            setPreview(await api('/admin/mail/preview', input()));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Destinataires">
            <select
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                invalidate();
              }}
            >
              <option value="all">Toutes les inscriptions confirmées</option>
              <option value="activity">Une activité</option>
              <option value="selection" disabled={!selected.length}>
                La sélection ({selected.length} participations)
              </option>
            </select>
          </Field>
          <Field label="Nature du message">
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                invalidate();
              }}
            >
              <option value="operational">Opérationnel</option>
              <option value="marketing">Promotionnel (avec consentement)</option>
            </select>
          </Field>
          {target === 'activity' && (
            <Field label="Activité">
              <select
                value={activity}
                onChange={(e) => {
                  setActivity(e.target.value);
                  invalidate();
                }}
              >
                {data.activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.distance}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Programmer l’envoi (facultatif)">
            <input
              type="datetime-local"
              value={schedule}
              onChange={(e) => {
                setSchedule(e.target.value);
                invalidate();
              }}
            />
          </Field>
        </div>
        <Field label="Objet">
          <input
            required
            maxLength={200}
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              invalidate();
            }}
          />
        </Field>
        <Field
          label="Votre message"
          hint="Variables : {{prenom}}, {{activite}}, {{numero}}. Le message est envoyé en texte clair pour conserver sa lisibilité."
        >
          <textarea
            required
            rows={10}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              invalidate();
            }}
          />
        </Field>
        <div className="actions">
          <Button busy={busy}>
            Prévisualiser et compter les destinataires <Eye size={16} />
          </Button>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              api(
                '/admin/templates',
                { id: templateId || undefined, name: templateName, subject, body, kind },
                'PUT',
              )
                .then((r) => {
                  setTemplateId(r.id);
                  setMessage('Modèle enregistré pour toute l’équipe.');
                  reloadTemplates();
                })
                .catch((e) => setError(e.message));
            }}
          >
            Enregistrer le modèle partagé
          </button>
        </div>
      </form>
      {preview && (
        <div className="detail-panel">
          <h3>{preview.count} destinataire(s) unique(s)</h3>
          <p className="small">
            Une adresse partagée reçoit un seul message. Les personnes désabonnées sont exclues des
            messages promotionnels.
          </p>
          <pre className="code-preview">{preview.preview}</pre>
          <Button
            disabled={!preview.count}
            busy={busy}
            onClick={async () => {
              if (!confirm('Confirmer la mise en file pour ' + preview.count + ' destinataire(s)?'))
                return;
              setBusy(true);
              try {
                const r = await api('/admin/mail', {
                  ...input(),
                  expectedCount: preview.count,
                  confirm: true,
                });
                setMessage(
                  r.status === 'development'
                    ? r.count + ' message(s) conservé(s) localement. Aucun envoi externe.'
                    : r.count + ' message(s) ajouté(s) à la file d’envoi.',
                );
                setCampaign(crypto.randomUUID());
                setPreview(null);
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmer pour {preview.count} destinataire(s) <Mail size={16} />
          </Button>
        </div>
      )}
      <section className="admin-section">
        <div className="admin-toolbar">
          <h3>Journal des courriels</h3>
          <button className="text-link" onClick={load}>
            Actualiser
          </button>
        </div>
        <p className="small">
          « Accepté par le service » ne signifie pas « livré ». Le statut livré provient du webhook
          du prestataire. La lecture des messages n’est pas suivie.
        </p>
        {rows?.map((r: any) => (
          <details className="mail-row" key={r.id}>
            <summary>
              <span>
                {r.subject}
                <br />
                <small>
                  {r.recipient} · {date(r.created_at)}
                </small>
              </span>
              <span className={'status ' + r.status}>{statuses[r.status] || r.status}</span>
            </summary>
            <p className="prewrap">{r.body}</p>
            <p>
              {r.attempts} tentative(s) · prévu : {date(r.available_at)}
            </p>
            {r.error && <Notice error>{r.error}</Notice>}
          </details>
        ))}
        {rows?.length === 0 && <p className="small">Aucun message.</p>}
      </section>
    </>
  );
}

function Checkin({ setError, setMessage, canUndo }: Feedback & { canUndo: boolean }) {
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<number | undefined>(undefined);
  const [camera, setCamera] = useState(false),
    [ticket, setTicket] = useState(''),
    [q, setQ] = useState(''),
    [matches, setMatches] = useState<any[]>([]),
    [result, setResult] = useState<any>(null),
    [busy, setBusy] = useState(false);
  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (timer.current) clearInterval(timer.current);
    setCamera(false);
  };
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );
  const scan = async () => {
    setError('');
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      stream.current = media;
      setCamera(true);
      const decoder = (await import('jsqr')).default;
      const canvas = document.createElement('canvas');
      timer.current = window.setInterval(() => {
        if (!video.current || video.current.readyState < 2) return;
        const v = video.current;
        if (v.srcObject !== media) {
          v.srcObject = media;
          v.play().catch(() => {});
        }
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context || !canvas.width) return;
        context.drawImage(v, 0, 0);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = decoder(image.data, image.width, image.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code?.data) {
          setTicket(code.data);
          stop();
          setMessage('Code détecté. Validez le billet ci-dessous.');
        }
      }, 250);
      setTimeout(() => {
        if (video.current) {
          video.current.srcObject = media;
          video.current.play().catch(() => {});
        }
      }, 100);
    } catch (e) {
      stop();
      setError('Caméra indisponible. Autorisez la caméra ou utilisez la recherche manuelle.');
    }
  };
  const validate = async (value: string, undo = false) => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const r = await api('/admin/checkin', { ticket: value, undo });
      setResult(r);
      setMessage(undo ? 'Présence annulée.' : 'Présence enregistrée.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="checkin-layout">
      <h2>Bienvenue sur la ligne de départ.</h2>
      <p className="small">
        Connexion Internet requise. Un billet déjà utilisé est refusé. Seules les inscriptions
        confirmées peuvent être accueillies.
      </p>
      <div className="actions" style={{ marginBottom: 25 }}>
        <Button onClick={camera ? stop : scan}>
          <Camera size={17} />
          {camera ? 'Fermer la caméra' : 'Scanner avec la caméra'}
        </Button>
      </div>
      {camera && (
        <video
          ref={video}
          className="checkin-video"
          autoPlay
          muted
          playsInline
          aria-label="Caméra de scan des billets"
        />
      )}
      <form
        className="form-panel"
        onSubmit={(e) => {
          e.preventDefault();
          validate(ticket);
        }}
      >
        <Field label="Code opaque du billet">
          <input
            value={ticket}
            onChange={(e) => setTicket(e.target.value)}
            required
            minLength={20}
            autoComplete="off"
            placeholder="Scannez un QR ou collez son code"
          />
        </Field>
        <Button busy={busy}>
          Valider la présence <Check size={16} />
        </Button>
      </form>
      {result && (
        <div className="scan-result">
          <Check size={24} /> {result.first_name} {result.last_name}
          <p className="small">
            {result.checked_at
              ? 'Présence confirmée à ' + date(result.checked_at)
              : 'Présence annulée.'}
          </p>
        </div>
      )}
      <form
        className="admin-section"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            setMatches(await api('/admin/checkin/search?q=' + encodeURIComponent(q)));
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <h3>Recherche manuelle</h3>
        <Field label="Nom ou numéro d’inscription">
          <input minLength={2} value={q} onChange={(e) => setQ(e.target.value)} required />
        </Field>
        <Button>
          Rechercher <Search size={16} />
        </Button>
      </form>
      {matches.map((r) => (
        <div className="detail-panel" key={r.id}>
          <h3>
            {r.first_name} {r.last_name}
          </h3>
          <p className="small">
            {r.name} · {r.distance} · {statuses[r.status]}
          </p>
          <p className="small">
            {r.checked_at ? 'Déjà accueilli à ' + date(r.checked_at) : 'Non accueilli'}
          </p>
          <div className="actions">
            <Button
              disabled={!!r.checked_at || !['confirmed', 'partially_refunded'].includes(r.status)}
              onClick={() => validate(r.ticket)}
            >
              Confirmer la présence
            </Button>
            {canUndo && !!r.checked_at && (
              <button
                className="text-link"
                onClick={() => {
                  if (confirm('Annuler cette présence?')) validate(r.ticket, true);
                }}
              >
                Annuler la présence
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
function Submissions({ setError, setMessage }: Feedback) {
  const [rows, load] = useLoad('/admin/submissions', setError);
  return (
    <>
      <h2>Les mains levées.</h2>
      <p className="small">
        Demandes de bénévolat, de partenariat, de contact et de confidentialité.
      </p>
      {rows?.map((r: any) => (
        <details className="mail-row" key={r.id}>
          <summary>
            <span>
              {r.name} ·{' '}
              {
                (
                  {
                    volunteer: 'Bénévolat',
                    sponsor: 'Partenariat',
                    contact: 'Contact',
                    privacy: 'Données personnelles',
                  } as any
                )[r.kind]
              }
              <br />
              <small>
                {r.email} · {date(r.created_at)}
              </small>
            </span>
            <span className="status">
              {({ new: 'Nouveau', in_progress: 'En cours', closed: 'Traité' } as any)[r.status]}
            </span>
          </summary>
          <p className="prewrap">{r.message}</p>
          <div className="actions">
            <a className="button" href={'mailto:' + r.email}>
              Répondre par courriel <ArrowUpRight size={15} />
            </a>
            <Field label="Traitement">
              <select
                value={r.status}
                onChange={async (e) => {
                  try {
                    await api('/admin/submissions/' + r.id, { status: e.target.value }, 'PATCH');
                    setMessage('Demande mise à jour.');
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <option value="new">Nouveau</option>
                <option value="in_progress">En cours</option>
                <option value="closed">Traité</option>
              </select>
            </Field>
          </div>
        </details>
      ))}
      {rows?.length === 0 && <p>Aucune demande pour le moment.</p>}
    </>
  );
}
function Staff({ setError, setMessage }: Feedback) {
  const [rows, load] = useLoad('/admin/staff', setError);
  const [permissions, setPermissions] = useState<string[]>(['participants']),
    [role, setRole] = useState('organizer');
  return (
    <>
      <h2>Une équipe, les bons accès.</h2>
      <p className="small">
        Chaque membre doit d’abord créer son compte par courriel. Les accès au personnel sont
        vérifiés côté serveur; la production exige également Cloudflare Access avec une politique
        MFA.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Courriel</th>
              <th>Rôle</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((r: any) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.email}</td>
                <td>{r.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="form-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            await api(
              '/admin/staff',
              {
                email: f.get('email'),
                role,
                permissions: role === 'checkin' ? ['checkin'] : permissions,
              },
              'PUT',
            );
            setMessage('Accès de l’équipe mis à jour.');
            await load();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <Field label="Courriel du membre (existant pour modifier l’accès)">
          <input type="email" name="email" required />
        </Field>
        <Field label="Rôle">
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="organizer">Organisateur</option>
            <option value="checkin">Bénévole d’accueil</option>
            <option value="admin">Administrateur principal</option>
          </select>
        </Field>
        {role === 'organizer' &&
          [
            ['participants', 'Gérer les dossiers'],
            ['export', 'Exporter les participants'],
            ['refunds', 'Demander des remboursements'],
            ['event', 'Modifier l’événement et les formulaires'],
            ['communications', 'Envoyer des communications'],
            ['checkin', 'Valider les billets'],
            ['submissions', 'Traiter les demandes reçues'],
          ].map(([key, label]) => (
            <label className="checkbox" key={key}>
              <input
                type="checkbox"
                checked={permissions.includes(key)}
                onChange={(e) =>
                  setPermissions(
                    e.target.checked ? [...permissions, key] : permissions.filter((k) => k !== key),
                  )
                }
              />
              {label}
            </label>
          ))}
        <Button>
          Enregistrer les accès <ShieldCheck size={16} />
        </Button>
      </form>
    </>
  );
}
function Audit({ setError }: Feedback) {
  const [rows, load] = useLoad('/admin/audit', setError);
  return (
    <>
      <div className="admin-toolbar">
        <h2>La trace des actions.</h2>
        <Button onClick={load}>Actualiser</Button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Action</th>
              <th>Acteur</th>
              <th>Cible</th>
              <th>Détails</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((r: any) => (
              <tr key={r.id}>
                <td>{date(r.at)}</td>
                <td>{r.action}</td>
                <td>{r.actor.slice(0, 10)}</td>
                <td>{r.target.slice(0, 12)}</td>
                <td>
                  <details>
                    <summary>Voir</summary>
                    <pre>{JSON.stringify(JSON.parse(r.detail), null, 2)}</pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
