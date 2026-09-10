import { ApiError, type PaymentDetails } from '@opentranscription/sdk';

/** 1 credit = $0.01. */
const dollars = (credits: number): string =>
  `${credits < 0 ? '-' : ''}$${(Math.abs(credits) / 100).toFixed(2)}`;

const paymentLines = (payment: PaymentDetails): string[] => {
  const lines = [
    `Balance: ${dollars(payment.balance_credits)}. This request needs ${dollars(payment.required_credits)}.`,
  ];
  if (payment.reset_at) {
    lines.push(`Free minutes reset on ${payment.reset_at.slice(0, 10)}.`);
  }
  lines.push(`Add credits (sign in on the web): ${payment.checkout_url}`);
  return lines;
};

/**
 * What the bin entry prints for a failure. A refused payment also says what
 * the request would cost and where to add credits: an agent can hand the user
 * a link, but only the user can top up, and "Insufficient credits" alone
 * leaves them hunting for the billing page.
 */
export const describeError = (error: unknown): string => {
  if (!(error instanceof Error)) return 'Something went wrong.';
  if (error instanceof ApiError && error.payment) {
    return [error.message, ...paymentLines(error.payment)].join('\n');
  }
  return error.message;
};
