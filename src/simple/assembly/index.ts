import { storage, Context } from 'near-sdk-as';

const commitments: any = {
  // TODO: Everywhere that touches this placeholder var needs to be updated to use NEAR. Maybe https://docs.near.org/docs/concepts/data-storage#persistentmap
  recipient1: {
    matcher1: 324,
    matcher2: 950,
  },
};

export function offerMatchingFunds(recipient: string, amount: number): string {
  const total = Context.predecessor in commitments[recipient] ? commitments[recipient][Context.predecessor] + amount : amount; // TODO use exact-math?
  commitments[recipient][Context.predecessor] = total;
  return `${Context.predecessor} is now committed to match donations to ${recipient} up to a maximum of ${total}`;
}

export function rescindMatchingFunds(recipient: string, amount: number): string {
  const total = commitments[recipient][Context.predecessor];
  if (amount >= total) {
    delete commitments[recipient][Context.predecessor];
    return `${Context.predecessor} is not matching donations to ${recipient} anymore`;
  } else {
    commitments[recipient][Context.predecessor] = commitments[recipient][Context.predecessor] - amount; // TODO use exact-math?
    return `${Context.predecessor} rescinded ${amount} and so is now only committed to match donations to ${recipient} up to a maximum of ${total}`;
  }
}

function transfer(sender: string, recipient: string, amount: number): string {
  // TODO transfer funds
  /*
  // https://github.com/Learn-NEAR/NCD.L1.sample--thanks/blob/bfe073b572cce35f0a9748a7d4851c2cfa5f09b9/src/thanks/assembly/index.ts#L56
  this.assert_owner();

  assert(this.contributions.received > u128.Zero, 'No received (pending) funds to be transferred');

  const to_self = Context.contractName;
  const to_owner = ContractPromiseBatch.create(this.owner);

  // transfer earnings to owner then confirm transfer complete
  const promise = to_owner.transfer(this.contributions.received);
  promise.then(to_self).function_call('on_transfer_complete', '{}', u128.Zero, XCC_GAS);*/
  return `${sender} donated ${amount} to ${recipient}`;
}

export function donate(recipient: string, amount: number): string {
  const messages = [];
  const mainDonationMessage = transfer(Context.predecessor, recipient, amount);
  messages.push(mainDonationMessage);

  Object.keys(commitments[recipient]).forEach((matcher: string) => {
    const matchedAmount = Math.min(amount, commitments[recipient][matcher]); // TODO use exact-math?
    const message = transfer(matcher, recipient, matchedAmount);
    messages.push(message);
  });

  return messages.join(' ');
}
