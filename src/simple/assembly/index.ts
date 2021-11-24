import { PersistentUnorderedMap, Context, u128, logging, ContractPromiseBatch } from 'near-sdk-as';
import { AccountId, assert_self, assert_single_promise_success, XCC_GAS } from '../../utils';

// TODO: Write tests for everything in this file.

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
  const escrow = Context.contractName;
  const matcher = Context.sender;
  // Transfer amount to escrow.
  simpleTransfer(escrow, amount); // Funds go from matcher to contractName (a.k.a. "self" or "escrow").
  // TODO: Probably the rest of this function should be moved to a callback.
  let total = amount;
  if (commitments.contains(recipient)) {
    const matchersForThisRecipient = commitments.getSome(recipient);
    if (matchersForThisRecipient.contains(matcher)) {
      const existingCommitment = matchersForThisRecipient.getSome(matcher);
      total = u128.add(existingCommitment, amount);
    }
    matchersForThisRecipient.set(matcher, total);
  } else {
    const matcherAccountIdCommitmentAmountMap = new PersistentUnorderedMap<AccountId, u128>(`matcherAccountIdCommitmentAmountMap_${matcher}`);
    matcherAccountIdCommitmentAmountMap.set(matcher, amount);
    commitments.set(recipient, matcherAccountIdCommitmentAmountMap);
  }
  const result = `${matcher} is now committed to match donations to ${recipient} up to a maximum of ${total}`;
  logging.log(result);
  return result;
}

function min(a: u128, b: u128): u128 {
  // Is there a built-in library function to use here instead?
  return u128.lt(a, b) ? a : b;
}

export function rescindMatchingFunds(recipient: AccountId, amount: u128): string {
  const matcher = Context.sender;
  // Should fail unless recipient exists and the funds previously committed by this matcher to this recipient are GTE this amount to rescind.
  transferFromEscrow(matcher, amount); // Funds go from escrow back to the matcher.
  // TODO: Probably the rest of this function should be moved to a callback.
  const matchersForThisRecipient = commitments.getSome(recipient);
  const total = matchersForThisRecipient.getSome(matcher);
  let amountToRescind = amount;
  let result: string;
  if (amount >= total) {
    amountToRescind = total;
    matchersForThisRecipient.delete(matcher);
    result = `${matcher} is not matching donations to ${recipient} anymore`;
  } else {
    matchersForThisRecipient.set(matcher, u128.sub(total, amountToRescind));
    result = `${matcher} rescinded ${amountToRescind} and so is now only committed to match donations to ${recipient} up to a maximum of ${total}`;
  }
  logging.log(result);
  return result;
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
  return toDestinationAccount.transfer(amount); // TODO: CRITICAL! How can it come FROM the escrow account instead? https://github.com/near-examples/cross-contract-calls
}

function sendMatchingDonation(matcher: AccountId, recipient: AccountId, amount: u128, matchersForThisRecipient: MatcherAccountIdCommitmentAmountMap): string {
  const escrow = Context.contractName;
  const remainingCommitment: u128 = matchersForThisRecipient.getSome(matcher);
  const matchedAmount: u128 = min(amount, remainingCommitment);
  const transferPromise = transferFromEscrow(recipient, matchedAmount);

  // https://github.com/Learn-NEAR/NCD.L1.sample--thanks/blob/bfe073b572cce35f0a9748a7d4851c2cfa5f09b9/src/thanks/assembly/index.ts#L56

  transferPromise.then(escrow).function_call('onTransferComplete', '{}', u128.Zero, XCC_GAS); // TODO: Learn what this means and whether it is correct.
  const result = `${matcher} sent a matching donation of ${matchedAmount} to ${recipient}`;
  logging.log(result);
  return result;
}

export function donate(recipient: AccountId, amount: u128): string {
  assert(amount > u128.Zero, '`amount` must be > 0');
  const sender = Context.sender;
  const matchersForThisRecipient = commitments.getSome(recipient);
  const messages: string[] = [];
  simpleTransfer(recipient, amount);
  // TODO: Assert that the simpleTransfer succeeded.
  const mainDonationMessage = `${sender} donated ${amount} to ${recipient}`;
  messages.push(mainDonationMessage);
  const matcherKeysForThisRecipient = matchersForThisRecipient.keys();
  for (let i = 0; i < matcherKeysForThisRecipient.length; i += 1) {
    const matcher = matcherKeysForThisRecipient[i];
    const message = sendMatchingDonation(matcher, recipient, amount, matchersForThisRecipient);
    messages.push(message);
  }
  const result = messages.join(' ');
  logging.log(result);
  return result;
}
