import { PersistentUnorderedMap, Context, u128, logging, ContractPromiseBatch } from 'near-sdk-as';
import { AccountId, assert_self, assert_single_promise_success, min, XCC_GAS } from '../../utils';

// TODO: Write tests for everything in this file. And build a frontend, too!

// https://github.com/near-examples/cross-contract-calls/blob/a589ab817835f837201f4afa48be5961d8ce5360/contracts/00.orientation/README.md or maybe instead of the amount having been sent to escrow via `transfer`, I could follow this approach: https://github.com/Learn-NEAR/NCD.L1.sample--lottery/blob/2bd11bc1092004409e32b75736f78adee821f35b/src/lottery/assembly/index.ts#L149 See also https://github.com/near/NEPs/blob/07dbc5c5dc98eb5dad47c567f93a4e5479ce5aaf/specs/Standards/FungibleToken/Core.md

type MatcherAccountIdCommitmentAmountMap = PersistentUnorderedMap<AccountId, u128>; // Maybe https://docs.near.org/docs/concepts/data-storage#persistentset would be more efficient and safer and protect against DDOS attacks that Sherif mentioned.

function _getMatcherCommitmentsToRecipient(recipient: AccountId): MatcherAccountIdCommitmentAmountMap {
  return new PersistentUnorderedMap<AccountId, u128>(`commitments_to_${recipient}`); // Maybe https://docs.near.org/docs/concepts/data-storage#persistentset would be more efficient and safer and protect against DDOS attacks that Sherif mentioned.
}

export function offerMatchingFunds(recipient: AccountId): string {
  const matcher = Context.sender;
  const amount = Context.attachedDeposit;
  assert(u128.gt(amount, u128.Zero), '`attachedDeposit` must be > 0.');
  const matchersForThisRecipient = _getMatcherCommitmentsToRecipient(recipient);
  let total = amount;
  if (matchersForThisRecipient.contains(matcher)) {
    const existingCommitment = matchersForThisRecipient.getSome(matcher);
    total = u128.add(existingCommitment, amount);
  }
  matchersForThisRecipient.set(matcher, total);
  const result = `${matcher} is now committed to match donations to ${recipient} up to a maximum of ${total}.`;
  logging.log(result);
  return result;
}

/**
 * view
 */
export function getCommitments(recipient: AccountId): string {
  const matchersLog: string[] = [];
  const matchersForThisRecipient = _getMatcherCommitmentsToRecipient(recipient);
  const matchers = matchersForThisRecipient.keys();
  for (let i = 0; i < matchers.length; i += 1) {
    const matcher = matchers[i];
    const existingCommitment: u128 = matchersForThisRecipient.getSome(matcher);
    const msg = `${matcher} is committed to match donations to ${recipient} up to a maximum of ${existingCommitment.toString()}.`;
    logging.log(msg);
    matchersLog.push(msg);
  }
  return matchersLog.join(' ');
}

function _transferFromEscrow(destinationAccount: AccountId, amount: u128): ContractPromiseBatch {
  const toDestinationAccount = ContractPromiseBatch.create(destinationAccount);
  return toDestinationAccount.transfer(amount);
}

/**
 * Gets called via `function_call`
 */
function _setMatcherAmount(recipient: AccountId, matcher: AccountId, amount: u128): MatcherAccountIdCommitmentAmountMap {
  assert_self();
  assert_single_promise_success();
  const matchersForThisRecipient = _getMatcherCommitmentsToRecipient(recipient);
  if (u128.gt(amount, u128.Zero)) {
    matchersForThisRecipient.set(matcher, amount);
  } else {
    matchersForThisRecipient.delete(matcher);
  }
  return matchersForThisRecipient;
}

export function rescindMatchingFunds(recipient: AccountId, requestedAmount: string): string {
  const escrow = Context.contractName;
  const matcher = Context.sender;
  const requestedWithdrawalAmount = u128.fromString(requestedAmount); // or maybe https://docs.near.org/docs/tutorials/create-transactions#formatting-token-amounts
  const matchersForThisRecipient = _getMatcherCommitmentsToRecipient(recipient);
  let result: string;
  if (matchersForThisRecipient.contains(matcher)) {
    const amountAlreadyCommitted = matchersForThisRecipient.getSome(matcher);
    let amountToDecrease = requestedWithdrawalAmount;
    let newAmount = u128.Zero;
    if (u128.ge(requestedWithdrawalAmount, amountAlreadyCommitted)) {
      amountToDecrease = amountAlreadyCommitted;
      result = `${matcher} rescinded ${amountToDecrease} and is not matching donations to ${recipient} anymore`;
    } else {
      newAmount = u128.sub(amountAlreadyCommitted, amountToDecrease);
      result = `${matcher} rescinded ${amountToDecrease} and so is now only committed to match donations to ${recipient} up to a maximum of ${newAmount}.`;
    }
    _transferFromEscrow(matcher, amountToDecrease) // Funds go from escrow back to the matcher.
      .then(escrow)
      .function_call('_setMatcherAmount', `{"recipient":"${recipient}","matcher":"${matcher}","amount":"${newAmount}"}`, u128.Zero, XCC_GAS);
  } else {
    result = `${matcher} does not currently have any funds committed to ${recipient}, so funds cannot be rescinded.`;
  }
  logging.log(result);
  return result;
}

function _sendMatchingDonation(matcher: AccountId, recipient: AccountId, amount: u128, matchersForThisRecipient: MatcherAccountIdCommitmentAmountMap, escrow: AccountId): void {
  const remainingCommitment: u128 = matchersForThisRecipient.getSome(matcher);
  const matchedAmount: u128 = min(amount, remainingCommitment);
  logging.log(`${matcher} will send a matching donation of ${matchedAmount} to ${recipient}.`);
  _transferFromEscrow(recipient, matchedAmount)
    .then(escrow)
    .function_call('_setMatcherAmount', `{"recipient":"${recipient}","matcher":"${matcher}","amount":"${matchedAmount}"}`, u128.Zero, XCC_GAS);
}

function _sendMatchingDonations(recipient: AccountId, amount: u128, escrow: AccountId): void {
  const matchersForThisRecipient = _getMatcherCommitmentsToRecipient(recipient);
  const matcherKeysForThisRecipient = matchersForThisRecipient.keys();
  for (let i = 0; i < matcherKeysForThisRecipient.length; i += 1) {
    const matcher = matcherKeysForThisRecipient[i];
    _sendMatchingDonation(matcher, recipient, amount, matchersForThisRecipient, escrow);
  }
}

/**
 * Gets called via `function_call`
 */
function _transferFromEscrowCallbackAfterDonating(donor: AccountId, recipient: AccountId, amount: u128, escrow: AccountId): void {
  assert_self();
  assert_single_promise_success();

  logging.log(`_transferFromEscrowCallbackAfterDonating. ${donor} donated ${amount} to ${recipient}.`);
  _sendMatchingDonations(recipient, amount, escrow);
}

export function donate(recipient: AccountId): void {
  const amount = Context.attachedDeposit;
  assert(u128.gt(amount, u128.Zero), '`attachedDeposit` must be > 0.');
  const donor = Context.sender;
  const escrow = Context.contractName;
  _transferFromEscrow(recipient, amount) // Immediately pass it along.
    .then(escrow)
    .function_call('_transferFromEscrowCallbackAfterDonating', `{"donor":"${donor}","recipient":"${recipient}","amount":"${amount}","escrow":"${escrow}"}`, u128.Zero, XCC_GAS);
}
