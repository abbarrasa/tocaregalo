export type RandomIndex = (exclusiveUpperBound: number) => number;
export type Assignment = Readonly<{ giverId: string; recipientId: string }>;

export function secureRandomIndex(exclusiveUpperBound: number): number {
  const range = 2 ** 32;
  if (!Number.isInteger(exclusiveUpperBound) || exclusiveUpperBound < 1 || exclusiveUpperBound > range) {
    throw new RangeError('Invalid random index bound.');
  }

  const limit = range - range % exclusiveUpperBound;
  const word = new Uint32Array(1);
  do {
    crypto.getRandomValues(word);
  } while (word[0] >= limit);
  return word[0] % exclusiveUpperBound;
}

export function shuffled<T>(values: readonly T[], nextIndex: RandomIndex): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = nextIndex(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i) {
      throw new RangeError('Random source returned an out-of-range index.');
    }
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function drawRecipients(
  memberIds: readonly string[],
  nextIndex: RandomIndex = secureRandomIndex,
): Assignment[] {
  if (memberIds.length < 3 || new Set(memberIds).size !== memberIds.length) {
    throw new RangeError('A draw requires at least three distinct participants.');
  }

  // Conditioning a uniform permutation on having no fixed points is uniform
  // over all derangements. Include every member, including the owner.
  let recipients: string[];
  do {
    recipients = shuffled(memberIds, nextIndex);
  } while (recipients.some((recipientId, i) => recipientId === memberIds[i]));

  return memberIds.map((giverId, i) => ({ giverId, recipientId: recipients[i] }));
}
