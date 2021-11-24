import { storage, Context, u128, logging } from 'near-sdk-as';

/**
 * Account IDs in NEAR are just strings. https://github.com/Learn-NEAR/NCD.L1.sample--meme-museum/blob/8c5d025d363f89fdcc7335d58d61a8e3307cd95a/src/utils.ts#L34
 */
export type AccountId = string;

const commitments: any = {
  // TODO: Everywhere that touches this placeholder var needs to be updated to use NEAR. Maybe https://docs.near.org/docs/concepts/data-storage#persistentmap
  recipient1: {
    matcher1: 324,
    matcher2: 950,
  },
};

export function offerMatchingFunds(recipient: AccountId, amount: u128): string {
  const { predecessor } = Context;
  const total = predecessor in commitments[recipient] ? u128.add(commitments[recipient][predecessor], amount) : amount;
  commitments[recipient][predecessor] = total;
  const result = `${predecessor} is now committed to match donations to ${recipient} up to a maximum of ${total}`;
  logging.log(result);
  return result;
}

export function rescindMatchingFunds(recipient: AccountId, amount: u128): string {
  const { predecessor } = Context;
  const total = commitments[recipient][predecessor];
  let result;
  if (amount >= total) {
    delete commitments[recipient][predecessor];
    result = `${predecessor} is not matching donations to ${recipient} anymore`;
  } else {
    commitments[recipient][predecessor] = u128.sub(commitments[recipient][predecessor], amount);
    result = `${predecessor} rescinded ${amount} and so is now only committed to match donations to ${recipient} up to a maximum of ${total}`;
  }
  logging.log(result);
  return result;
}

function transfer(sender: AccountId, recipient: AccountId, amount: u128): string {
  // TODO transfer funds!
  /*
  // https://github.com/Learn-NEAR/NCD.L1.sample--thanks/blob/bfe073b572cce35f0a9748a7d4851c2cfa5f09b9/src/thanks/assembly/index.ts#L56
  this.assert_owner();

  assert(this.contributions.received > u128.Zero, 'No received (pending) funds to be transferred');

  const to_self = Context.contractName;
  const to_owner = ContractPromiseBatch.create(this.owner);

  // transfer earnings to owner then confirm transfer complete
  const promise = to_owner.transfer(this.contributions.received);
  promise.then(to_self).function_call('on_transfer_complete', '{}', u128.Zero, XCC_GAS);*/
  const result = `${sender} donated ${amount} to ${recipient}`;
  logging.log(result);
  return result;
}

export function donate(recipient: AccountId, amount: u128): string {
  const { predecessor } = Context;
  const messages: string[] = [];
  const mainDonationMessage = transfer(predecessor, recipient, amount);
  messages.push(mainDonationMessage);

  Object.keys(commitments[recipient]).forEach((matcher: string) => {
    const matchedAmount: u128 = Math.min(amount, commitments[recipient][matcher]);
    const message = transfer(matcher, recipient, matchedAmount);
    messages.push(message);
  });

  const result = messages.join(' ');
  logging.log(result);
  return result;
}
