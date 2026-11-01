import React from 'react';
import {
  ADMIN_ACCESS_MESSAGE,
  ADMIN_ACCESS_URL,
  requiresDocumentNavigation,
  STAFF_REAUTH_MESSAGE,
} from '../shared/admin-access';
export function go(path: string) {
  if (requiresDocumentNavigation(path)) {
    location.assign(path);
    return;
  }
  history.pushState({}, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'instant' });
}
export function Link({ to, children, className = '', ...rest }: any) {
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        if (
          !e.ctrlKey &&
          !e.metaKey &&
          !e.shiftKey &&
          !e.altKey &&
          e.button === 0 &&
          !requiresDocumentNavigation(to)
        ) {
          e.preventDefault();
          go(to);
        }
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
export function Notice({ error, children }: any) {
  return (
    <div role={error ? 'alert' : 'status'} className={'notice ' + (error ? 'error' : '')}>
      {children}
      {error && children === ADMIN_ACCESS_MESSAGE && (
        <p>
          <a className="button" href={ADMIN_ACCESS_URL}>
            Vérifier mon accès administrateur
          </a>
        </p>
      )}
      {error && children === STAFF_REAUTH_MESSAGE && (
        <p>
          <a className="button" href="/connexion?retour=%2Forganisation&mode=sign-in&reauth=1">
            Vérifier mon accès équipe
          </a>
        </p>
      )}
    </div>
  );
}
export function Field({ label, children, hint }: any) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Button({ children, busy = false, className = '', ...props }: any) {
  return (
    <button
      className={'button ' + className}
      {...props}
      disabled={busy || props.disabled}
      aria-busy={busy}
    >
      {busy ? 'Un instant…' : children}
    </button>
  );
}

export function Page({ eyebrow, title, intro, children, className = '' }: any) {
  return (
    <div className={'page ' + className}>
      <div className="page-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h1 tabIndex={-1}>{title}</h1>
        {intro && <p className="page-intro">{intro}</p>}
      </div>
      {children}
    </div>
  );
}
export function DynamicFields({ fields, answers, onChange }: any) {
  return (
    <div className="dynamic-fields">
      {fields
        .filter((f: any) => !f.showWhen || answers[f.showWhen.field] === f.showWhen.equals)
        .map((f: any) =>
          f.type === 'checkbox' ? (
            <label className="checkbox" key={f.id}>
              <input
                type="checkbox"
                required={f.required}
                checked={!!answers[f.id]}
                onChange={(e) => onChange({ ...answers, [f.id]: e.target.checked })}
              />
              {f.label}
              {f.required ? ' *' : ''}
            </label>
          ) : (
            <Field key={f.id} label={f.label + (f.required ? ' *' : '')}>
              {f.type === 'select' ? (
                <select
                  required={f.required}
                  value={answers[f.id] || ''}
                  onChange={(e) => onChange({ ...answers, [f.id]: e.target.value })}
                >
                  <option value="">Choisir une réponse</option>
                  {f.options?.map((o: string) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  required={f.required}
                  maxLength={1000}
                  value={answers[f.id] || ''}
                  onChange={(e) => onChange({ ...answers, [f.id]: e.target.value })}
                />
              )}
            </Field>
          ),
        )}
    </div>
  );
}
