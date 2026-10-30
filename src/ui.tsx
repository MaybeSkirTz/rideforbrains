import React from 'react';
export function go(path: string) {
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
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
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
