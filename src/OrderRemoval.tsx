import { useEffect, useRef, useState } from 'react';
import { api, money, date, statuses } from './api';
import { Button, Field, Notice } from './ui';
export default function OrderRemoval({
  orderId,
  onRemoved,
}: {
  orderId: string;
  onRemoved: (result: any) => void;
}) {
  const [preview, setPreview] = useState<any>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [reason, setReason] = useState('Retrait administratif de la commande');
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    dialog.current?.close();
    setPreview(undefined);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (preview) {
      dialog.current?.showModal();
      dialog.current?.querySelector<HTMLElement>('h2')?.focus();
      if (dialog.current) dialog.current.scrollTop = 0;
    }
  }, [preview]);
  return (
    <section className="admin-section removal-section">
      <h3>Retirer la commande complète</h3>
      <p>
        Retire toutes ses participations des listes, exports et statistiques. Les billets deviennent
        invalides. Une trace comptable privée est conservée.
      </p>
      <button
        ref={trigger}
        className="button removal-button"
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            setPreview(await api('/admin/orders/' + orderId + '/removal-preview'));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Retirer toute la commande
      </button>
      {error && !preview && <Notice error>{error}</Notice>}
      <dialog
        ref={dialog}
        className="removal-dialog"
        aria-labelledby="removal-title"
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else {
            setPreview(undefined);
            trigger.current?.focus();
          }
        }}
      >
        {preview && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                const result = await api('/admin/orders/' + orderId + '/remove', {
                  confirm: true,
                  expectedRefund: preview.refundRequested,
                  reason,
                });
                close();
                onRemoved(result);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="eyebrow">COMMANDE {orderId.slice(0, 8)}</p>
            <h2 id="removal-title" tabIndex={-1}>
              Retirer ces {preview.registrations.length} participation(s) ?
            </h2>
            <p>{preview.buyerEmail}</p>
            <ul>
              {preview.registrations.map((r: any) => (
                <li key={r.id}>
                  {r.first_name} {r.last_name} · {r.name} {r.distance} · {money(r.price)}
                </li>
              ))}
            </ul>
            <dl className="removal-amounts">
              <div>
                <dt>Montant réellement payé après rabais</dt>
                <dd>{money(preview.paid)}</dd>
              </div>
              <div>
                <dt>Déjà remboursé</dt>
                <dd>{money(preview.refunded)}</dd>
              </div>
              <div>
                <dt>Remboursement à demander</dt>
                <dd>
                  <strong>{money(preview.refundRequested)}</strong>
                </dd>
              </div>
            </dl>
            {preview.promo && (
              <p>
                Code appliqué : {preview.promo}. Le remboursement utilise le montant payé après ce
                rabais.
              </p>
            )}
            {preview.blocked ? (
              <Notice error>
                Un remboursement est en cours ou doit être rapproché. Le retrait est bloqué jusqu’à
                résolution.
              </Notice>
            ) : !preview.eligible && preview.paid > 0 ? (
              <Notice>
                Aucun remboursement : la demande est à moins de 15 jours de l’événement.
              </Notice>
            ) : preview.refundRequested > 0 ? (
              <Notice>
                Le remboursement sera demandé à Stripe. Sa confirmation finale sera envoyée
                séparément.
              </Notice>
            ) : (
              <Notice>Aucun nouveau remboursement à effectuer.</Notice>
            )}
            <Field label="Motif privé du retrait">
              <textarea
                value={reason}
                minLength={3}
                maxLength={500}
                required
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <label className="checkbox">
              <input type="checkbox" required />
              Je confirme le retrait de toute cette commande et l’invalidation de ses billets.
            </label>
            <p className="small">
              Un courriel confirmera le retrait à l’acheteur et à l’administrateur qui effectue
              cette action.
            </p>
            {error && <Notice error>{error}</Notice>}
            <div className="actions">
              <Button type="button" className="button light" disabled={busy} onClick={close}>
                Garder la commande
              </Button>
              <Button
                busy={busy}
                className="button removal-button"
                disabled={preview.blocked || preview.removed}
              >
                Confirmer le retrait
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </section>
  );
}
export function RemovedOrders() {
  const [rows, setRows] = useState<any[]>(),
    [error, setError] = useState('');
  const load = () =>
    api('/admin/removed-orders')
      .then(setRows)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <h2>Retraits — traces privées</h2>
      <p>
        Ces commandes sont exclues des listes et statistiques de l’événement. Cette trace est
        réservée aux administrateurs pour le suivi comptable et les remboursements.
      </p>
      <Button onClick={load}>Actualiser le suivi</Button>
      {error && <Notice error>{error}</Notice>}
      {rows?.map((r) => (
        <details className="mail-row" key={r.order_id}>
          <summary>
            Commande {r.order_id.slice(0, 8)} · retirée le {date(r.created_at)}
          </summary>
          <p>
            {r.participants} participation(s) · {r.removed_by}
          </p>
          <p className="prewrap">{r.reason}</p>
          <p>
            Montant de commande après rabais : {money(r.amount)} · remboursé : {money(r.refunded)}.
          </p>
          <p>
            Demandé au retrait : {money(r.refund_amount)} · suivi :{' '}
            {r.refund_status
              ? (
                  {
                    queued: 'En file',
                    processing: 'Traitement en cours',
                    pending: 'Confirmation Stripe attendue',
                    succeeded: 'Confirmé par Stripe',
                    failed: 'Échec — rapprochement nécessaire',
                    review: 'À rapprocher avec Stripe',
                  } as any
                )[r.refund_status] || r.refund_status
              : 'Aucun remboursement demandé'}
            .
          </p>
          <p className="small">
            {r.confirmations} confirmation(s) mise(s) en file.{' '}
            {r.checkout_closed
              ? 'Ancien paiement clôturé.'
              : 'Vérification de clôture du paiement en cours.'}
          </p>
        </details>
      ))}
      {rows?.length === 0 && <p>Aucune commande retirée.</p>}
    </>
  );
}
