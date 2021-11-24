import { PersistentUnorderedMap, Context, u128, logging, ContractPromise, ContractPromiseBatch } from 'near-sdk-as';

const XCC_GAS = 20000000000000; // https://github.com/Learn-NEAR/NCD.L1.sample--meme-museum/blob/8c5d025d363f89fdcc7335d58d61a8e3307cd95a/src/utils.ts#L15

/**
 * Account IDs in NEAR are just strings. https://github.com/Learn-NEAR/NCD.L1.sample--meme-museum/blob/8c5d025d363f89fdcc7335d58d61a8e3307cd95a/src/utils.ts#L34
 */
type AccountId = string;

type MatcherAccountIdCommitmentAmountMap = PersistentUnorderedMap<AccountId, u128>; // Maybe https://docs.near.org/docs/concepts/data-storage#persistentset would be more efficient and safer and protect against DDOS attacks that Sherif mentioned.

const commitments = new PersistentUnorderedMap<AccountId, MatcherAccountIdCommitmentAmountMap>('allCommitments'); // See comment above about PersistentSet​.
/*{
  recipient1: {
    matcher1: 324,
    matcher2: 950,
  },
  recipient2: {
    matcher2: 12,
    matcher3: 55,
  },
}*/

export function offerMatchingFunds(recipient: AccountId, amount: u128): string {
  const { sender } = Context;
  // TODO: Transfer amount to escrow. Then probably the rest of this function should be moved to a callback.
  simpleTransfer(recipient, amount);
  let total = amount;
  if (commitments.contains(recipient)) {
    const matchersForThisRecipient = commitments.getSome(recipient);
    if (matchersForThisRecipient.contains(sender)) {
      const existingCommitment = matchersForThisRecipient.getSome(sender);
      total = u128.add(existingCommitment, amount);
    }
    matchersForThisRecipient.set(sender, total);
  } else {
    const matcherAccountIdCommitmentAmountMap = new PersistentUnorderedMap<AccountId, u128>('todo');
    matcherAccountIdCommitmentAmountMap.set(sender, amount);
    commitments.set(recipient, matcherAccountIdCommitmentAmountMap);
  }
  const result = `${sender} is now committed to match donations to ${recipient} up to a maximum of ${total}`;
  logging.log(result);
  return result;
}

function min(a: u128, b: u128): u128 {
  // Is there a built-in library function to use here instead?
  return u128.lt(a, b) ? a : b;
}

export function rescindMatchingFunds(recipient: AccountId, amount: u128): string {
  const { sender } = Context;
  // Should fail unless recipient exists and the funds previously committed by this matcher to this recipient are GTE this amount to rescind.
  // TODO: Transfer amountToRescind back from escrow to matcher. Then probably the rest of this function should be moved to a callback.
  transferFromEscrow(sender, amount);
  const matchersForThisRecipient = commitments.getSome(recipient);
  const total = matchersForThisRecipient.getSome(sender);
  let amountToRescind = amount;
  let result;
  if (amount >= total) {
    amountToRescind = total;
    matchersForThisRecipient.delete(sender);
    result = `${sender} is not matching donations to ${recipient} anymore`;
  } else {
    matchersForThisRecipient.set(sender, u128.sub(total, amountToRescind));
    result = `${sender} rescinded ${amountToRescind} and so is now only committed to match donations to ${recipient} up to a maximum of ${total}`;
  }
  logging.log(result);
  return result;
}

function assert_single_promise_success(): void {
  // https://github.com/Learn-NEAR/NCD.L1.sample--thanks/blob/bfe073b572cce35f0a9748a7d4851c2cfa5f09b9/src/utils.ts#L88
  const results = ContractPromise.getResults();
  assert(results.length === 1, 'Expected exactly one promise result');
  assert(results[0].succeeded, 'Expected PromiseStatus to be successful');
}

function assert_self(): void {
  // https://github.com/Learn-NEAR/NCD.L1.sample--thanks/blob/bfe073b572cce35f0a9748a7d4851c2cfa5f09b9/src/utils.ts#L82
  const caller = Context.sender;
  const self = Context.contractName;
  assert(caller === self, 'Only this contract may call itself');
}

function onTransferComplete(): void {
  assert_self();
  assert_single_promise_success();

  logging.log('transfer complete');
  //TODO: Figure out what this function should do, like https://github.com/Learn-NEAR/NCD.L1.sample--thanks/blob/bfe073b572cce35f0a9748a7d4851c2cfa5f09b9/src/thanks/assembly/index.ts#L76
}

function simpleTransfer(recipient: AccountId, amount: u128): ContractPromiseBatch {
  const toRecipient = ContractPromiseBatch.create(recipient);
  return toRecipient.transfer(amount);
}

function transferFromEscrow(destinationAccount: AccountId, amount: u128): ContractPromiseBatch {
  const toDestinationAccount = ContractPromiseBatch.create(destinationAccount);
  return toDestinationAccount.transfer(amount); // TODO: CRITICAL! How can it come FROM the escrow account instead?
}

function sendMatchingDonation(sender: AccountId, recipient: AccountId, amount: u128): string {
  const transferPromise = transferFromEscrow(recipient, amount);

  // https://github.com/Learn-NEAR/NCD.L1.sample--thanks/blob/bfe073b572cce35f0a9748a7d4851c2cfa5f09b9/src/thanks/assembly/index.ts#L56
  const to_self = Context.contractName;
  transferPromise.then(to_self).function_call('onTransferComplete', '{}', u128.Zero, XCC_GAS); // TODO: Learn what this means and whether it is correct.
  const result = `${sender} sent a matching donation of ${amount} to ${recipient}`;
  logging.log(result);
  return result;
}

export function donate(recipient: AccountId, amount: u128): string {
  assert(amount > u128.Zero, '`amount` must be > 0');
  const { sender } = Context;
  const matchersForThisRecipient = commitments.getSome(recipient);
  const messages: string[] = [];
  simpleTransfer(recipient, amount);
  // TODO: Assert that the simpleTransfer succeeded.
  const mainDonationMessage = `${sender} donated ${amount} to ${recipient}`;
  messages.push(mainDonationMessage);
  matchersForThisRecipient.keys().forEach((matcher: string) => {
    const remainingCommitment = matchersForThisRecipient.getSome(matcher);
    const matchedAmount: u128 = min(amount, remainingCommitment);
    const message = sendMatchingDonation(matcher, recipient, matchedAmount);
    messages.push(message);
  });
  const result = messages.join(' ');
  logging.log(result);
  return result;
}
