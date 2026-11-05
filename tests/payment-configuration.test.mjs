import { test } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {
  stripeConfigurationIssue,
  PaymentConfigurationError,
  paymentFailure,
} from '../server/payment-errors.ts';

test('Stripe configuration distinguishes missing, public, mismatched and local live keys without exposing them', () => {
  const issue = (key, mode = 'live', local = false) =>
    stripeConfigurationIssue({ key, mode, local });
  assert.equal(issue(undefined).code, 'STRIPE_KEY_MISSING');
  assert.equal(issue('pk_live_fixture').code, 'STRIPE_KEY_INVALID');
  assert.equal(issue('sk_test_fixture').code, 'STRIPE_MODE_MISMATCH');
  assert.equal(issue('sk_live_fixture', 'test').code, 'STRIPE_MODE_MISMATCH');
  assert.equal(issue('rk_live_fixture', 'live', true).code, 'STRIPE_LIVE_KEY_LOCAL');
  assert.equal(issue('sk_test_fixture', 'unknown').code, 'STRIPE_MODE_INVALID');
  assert.equal(issue(' sk_live_fixture\n'), null);
  assert.equal(issue('rk_live_fixture'), null);
  assert.equal(issue('sk_test_fixture', 'test', true), null);
  assert.equal(issue('rk_test_fixture', 'test', true), null);
  const diagnostic = paymentFailure(new PaymentConfigurationError(issue('sk_test_fixture')));
  assert.equal(diagnostic.status, 503);
  assert.equal(diagnostic.code, 'STRIPE_MODE_MISMATCH');
  assert.doesNotMatch(JSON.stringify(diagnostic), /sk_test_fixture/);
});

test('Stripe errors keep bounded identifiers and discard raw messages and unexpected values', () => {
  const error = new Stripe.errors.StripeAuthenticationError({
    message: 'Invalid key sk_live_do_not_publish for buyer@example.test',
    code: 'api_key_expired',
    requestId: 'req_fixture123',
    param: 'line_items[0][price_data][unit_amount]',
  });
  const failure = paymentFailure(error);
  assert.equal(failure.status, 503);
  assert.equal(failure.diagnostics.stripeRequestId, 'req_fixture123');
  assert.equal(failure.diagnostics.stripeCode, 'api_key_expired');
  assert.equal(failure.diagnostics.stripeParam, 'line_items[0][price_data][unit_amount]');
  assert.doesNotMatch(JSON.stringify(failure), /sk_live_do_not_publish|buyer@example/);
  error.code = 'buyer@example.test';
  error.requestId = 'not-a-request-id';
  error.param = 'sk_live_untrusted=value';
  const filtered = paymentFailure(error);
  assert.equal(filtered.diagnostics.stripeCode, undefined);
  assert.equal(filtered.diagnostics.stripeRequestId, undefined);
  assert.equal(filtered.diagnostics.stripeParam, undefined);
  assert.equal(
    paymentFailure(new Stripe.errors.StripeConnectionError({ message: 'private' })).status,
    502,
  );
  assert.equal(paymentFailure(new Error('Unrelated')), null);
});
