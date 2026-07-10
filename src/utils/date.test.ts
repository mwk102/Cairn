import { describe, expect, it } from 'vitest';

import { formatDateInput, parseDateInput } from './date';

describe('date input helpers', () => {
  it('parses YYYY-MM-DD dates', () => {
    expect(parseDateInput('2024-07-09')).toBe('2024-07-09T12:00:00.000Z');
  });

  it('rejects impossible or ambiguous dates', () => {
    expect(parseDateInput('2024-02-31')).toBeNull();
    expect(parseDateInput('07/09/2024')).toBeNull();
    expect(parseDateInput('')).toBeNull();
  });

  it('formats ISO dates for editing', () => {
    expect(formatDateInput('2024-07-09T12:00:00.000Z')).toBe('2024-07-09');
  });
});
