import { describe, expect, it } from 'vitest';

import { parseCoordinateInput, validateCoordinates } from './coordinates';

describe('parseCoordinateInput', () => {
  it.each([
    '47.90081, -119.17627',
    '47.90081 -119.17627',
    '(47.90081, -119.17627)',
    'Latitude: 47.90081, Longitude: -119.17627',
    '47.90081° N, 119.17627° W',
    '0, 0',
    '-90, -180',
    '90, 180',
  ])('parses %s', (input) => {
    const result = parseCoordinateInput(input);

    expect(result.status).toBe('valid');
  });

  it.each([
    '',
    '47.90081',
    '91, -119.17627',
    '-91, -119.17627',
    '47.90081, 181',
    '47.90081, -181',
    'not a place',
    '47.90081, -119.17627, 10',
  ])('rejects %s', (input) => {
    const result = parseCoordinateInput(input);

    expect(result.status).not.toBe('valid');
    expect(result.status).not.toBe('potentially-reversed');
  });

  it('distinguishes potentially reversed coordinates', () => {
    const result = parseCoordinateInput('-119.17627, 47.90081');

    expect(result.status).toBe('potentially-reversed');
    if (result.status === 'potentially-reversed') {
      expect(result.swapped).toEqual({ latitude: 47.90081, longitude: -119.17627 });
    }
  });
});

describe('validateCoordinates', () => {
  it('returns a latitude-specific error', () => {
    expect(validateCoordinates(91, -119).status).toBe('invalid');
    expect(validateCoordinates(91, -119)).toMatchObject({
      message: 'Latitude must be between -90 and 90.',
    });
  });

  it('returns a longitude-specific error', () => {
    expect(validateCoordinates(47, 181)).toMatchObject({
      status: 'invalid',
      message: 'Longitude must be between -180 and 180.',
    });
  });
});
