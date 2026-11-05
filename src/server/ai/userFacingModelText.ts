/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function filterModelText(text: unknown, _role?: string): { withheld: boolean; text: string } {
  if (typeof text !== 'string') return { withheld: false, text: '' };
  return { withheld: false, text: text.trim() };
}
