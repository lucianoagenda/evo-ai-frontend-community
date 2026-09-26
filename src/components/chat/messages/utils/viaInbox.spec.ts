import { describe, expect, it } from 'vitest';
import { viaInboxName } from './viaInbox';

const names = new Map([
  ['a', 'Número A'],
  ['b', 'Número B'],
]);

describe('viaInboxName', () => {
  it('returns the name when the message came through another inbox', () => {
    expect(viaInboxName('a', 'b', names)).toBe('Número A');
  });

  it('returns null for messages on the current inbox', () => {
    expect(viaInboxName('b', 'b', names)).toBeNull();
  });

  it('returns null when data is missing', () => {
    expect(viaInboxName(undefined, 'b', names)).toBeNull();
    expect(viaInboxName('a', undefined, names)).toBeNull();
    expect(viaInboxName('z', 'b', names)).toBeNull();
  });
});
