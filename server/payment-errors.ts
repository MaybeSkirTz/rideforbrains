import Stripe from 'stripe';

type ConfigurationIssue = { code: string; label: string };
export function stripeConfigurationIssue({
  key,
  mode,
  local,
}: {
  key?: string;
  mode: string;
  local: boolean;
}): ConfigurationIssue | null {
  const value = key?.trim();
  if (!value) return { code: 'STRIPE_KEY_MISSING', label: 'Clé secrète Stripe manquante.' };
  const keyMode = value.match(/^(?:sk|rk)_(live|test)_/);
  if (!keyMode)
    return {
      code: 'STRIPE_KEY_INVALID',
      label: 'Une clé secrète Stripe sk_ ou rk_ est requise; une clé publique pk_ ne convient pas.',
    };
  if (!['live', 'test'].includes(mode))
    return { code: 'STRIPE_MODE_INVALID', label: 'Le mode de paiement doit être live ou test.' };
  if (local && keyMode[1] === 'live')
    return {
      code: 'STRIPE_LIVE_KEY_LOCAL',
      label: 'Les clés Stripe réelles sont interdites sur le serveur local.',
    };
  if ((keyMode[1] === 'live') !== (mode === 'live'))
    return {
      code: 'STRIPE_MODE_MISMATCH',
      label:
        mode === 'live'
          ? 'Le site est en mode réel mais la clé Stripe est une clé de test.'
          : 'Le site est en mode test mais la clé Stripe est une clé réelle.',
    };
  return null;
}
export class PaymentConfigurationError extends Error {
  code: string;
  constructor(issue: ConfigurationIssue) {
    super(issue.label);
    this.name = 'PaymentConfigurationError';
    this.code = issue.code;
  }
}
const safe = (value: unknown, pattern: RegExp) =>
  typeof value === 'string' && pattern.test(value) ? value : undefined;

// Provider messages can contain API keys, email addresses or request values.
// Only bounded diagnostic identifiers enter the private Worker journal.
export function paymentFailure(error: unknown) {
  if (error instanceof PaymentConfigurationError)
    return {
      status: 503,
      code: error.code,
      message:
        'Le service de paiement est temporairement indisponible. L’organisation doit vérifier sa configuration.',
      diagnostics: { configurationReason: error.message },
    };
  if (!(error instanceof Stripe.errors.StripeError)) return null;
  const temporary =
    error instanceof Stripe.errors.StripeConnectionError ||
    error instanceof Stripe.errors.StripeAPIError ||
    error instanceof Stripe.errors.StripeRateLimitError;
  return {
    status: temporary ? 502 : 503,
    code: 'STRIPE_ERROR',
    message: temporary
      ? 'Le service de paiement ne répond pas pour le moment. Réessayez depuis votre espace.'
      : 'Le paiement ne peut pas être ouvert. Contactez l’organisation avec la référence ci-dessous.',
    diagnostics: {
      stripeType: safe(error.type, /^[A-Za-z]{1,64}$/),
      stripeCode: safe(error.code, /^[a-z_]{1,80}$/),
      stripeParam: safe(error.param, /^[a-zA-Z0-9_[\].-]{1,120}$/),
      stripeRequestId: safe(error.requestId, /^req_[a-zA-Z0-9]{1,100}$/),
    },
  };
}
