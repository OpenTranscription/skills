import { ApiError } from '@opentranscription/sdk';
import { describe, expect, it } from 'vitest';

import { describeError } from './errorMessage.js';

describe('describeError', () => {
  it('prints an ordinary error as its message', () => {
    expect(describeError(new Error('No such file: a.mp3'))).toBe(
      'No such file: a.mp3'
    );
  });

  it('never prints a non-Error value', () => {
    expect(describeError('boom')).toBe('Something went wrong.');
  });

  it('tells the user what a refused payment costs and where to add credits', () => {
    const error = new ApiError(
      'Outstanding balance. Please add credits to continue.',
      402,
      'NEGATIVE_BALANCE',
      {
        balance_credits: -12.35,
        required_credits: 75.5,
        checkout_url: 'https://opentranscription.io/settings/billing',
      }
    );

    expect(describeError(error)).toBe(
      [
        'Outstanding balance. Please add credits to continue.',
        'Balance: -$0.12. This request needs $0.76.',
        'Add credits (sign in on the web): https://opentranscription.io/settings/billing',
      ].join('\n')
    );
  });

  it('says when free minutes come back', () => {
    const error = new ApiError(
      'Free minutes exhausted.',
      402,
      'FREE_MINUTES_EXHAUSTED',
      {
        balance_credits: 0,
        required_credits: 30,
        checkout_url: 'https://opentranscription.io/settings/billing',
        reset_at: '2026-10-01T00:00:00.000Z',
      }
    );

    expect(describeError(error)).toContain('Free minutes reset on 2026-10-01.');
  });

  it('prints a 402 without payment details as the message alone', () => {
    const error = new ApiError(
      'Insufficient credits.',
      402,
      'INSUFFICIENT_CREDITS'
    );

    expect(describeError(error)).toBe('Insufficient credits.');
  });
});
