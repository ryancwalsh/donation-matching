# Donations With Automatic Matching Up to a Maximum

Someone (let's call them "Matcher") wants to pledge to match donations to a certain account (the "Recipient") and says "I'll match donations up to X amount." So he/she sends the max amount to the controlling contract (sort of like escrow) and earmarks those funds for Recipient.

For simplicity (to avoid complexity of expiration dates and cron jobs and whatever), any Matcher can at any time rescind any unclaimed funds. If the promised funds from that Matcher towards a specific Recipient become 0, the Matcher is removed (is no longer listed as a Matcher related to that Recipient).

Any other account (other Donors) can choose to donate to the Recipient account (via the controlling contract, which is this project).

On each donation:

1. Funds that the Donor deposited into this escrow contract get transferred immediately to the Recipient.
1. For each and every "Matcher" account currently associated with the Recipient, the following happens:
   1. This escrow contract will automatically transfer to the Recipient an amount (called "matchedAmount") that equals the minimum of the donor's donated amount and that Matcher's remaining commitment to this Recipient.
   1. The Matcher's commitment will be decreased by that "matchedAmount".

---

## Usage

1. clone this repo to a local folder
1. run `yarn`
1. Read https://docs.near.org/docs/tools/near-cli#near-call and decide whether you want to use `--depositYocto` or `--deposit` in the steps below.

### For localnet (work in progress; consider using testnet below for now):

1. `export NEAR_ENV=local`
1. [how to deploy contract locally?]

```
near create-account justatemporarylocalaccount.node0 --masterAccount node0 --initialBalance 1000 --keyPath ~/.near/localnet/node0/validator_key.json

near create-account recipient.justatemporarylocalaccount.node0 --masterAccount justatemporarylocalaccount.node0 --initialBalance 10

near create-account donor.justatemporarylocalaccount.node0 --masterAccount justatemporarylocalaccount.node0 --initialBalance 20

export MATCHER=justatemporarylocalaccount.node0
export RECIPIENT=recipient.justatemporarylocalaccount.node0
export DONOR=donor.justatemporarylocalaccount.node0
```

### For testnet:

1. `export NEAR_ENV=testnet`
1. `./scripts/1.dev-deploy.sh`
1. Follow the instructions from the output of the previous line. It will tell you to run something like `export CONTRACT=dev-1638053233399-4079004334`.
1. You will need at least 3 other NEAR accounts: one to act as a recipient (such as a charity), one to act as a regular donor, and one to act as a "matcher" (someone who commits to match others' donations to a certain recipient).

   - If you don't already have 3 testnet accounts that you want to use, you can create one (to serve as Matcher) at https://wallet.testnet.near.org/. Then you can create RECIPIENT and DONOR accounts as [sub-accounts](https://docs.near.org/docs/tools/near-cli#near-create-account) of that one. E.g.:

   ```
   near create-account recipient.ryancwalsh.testnet --masterAccount ryancwalsh.testnet --initialBalance 10
   near create-account matcher2.ryancwalsh.testnet --masterAccount ryancwalsh.testnet --initialBalance 10
   near create-account donor.ryancwalsh.testnet --masterAccount ryancwalsh.testnet --initialBalance 20
   ```

1. Call `export` commands to define RECIPIENT, MATCHER, and DONOR with the accountIds from the previous steps. E.g.:

   ```
   export MATCHER=ryancwalsh.testnet
   export MATCHER2=matcher2.ryancwalsh.testnet
   export RECIPIENT=recipient.ryancwalsh.testnet
   export DONOR=donor.ryancwalsh.testnet
   ```

### Now try using the contract (on localnet or testnet):

1. `near call $CONTRACT offerMatchingFunds "{\"recipient\": \"$RECIPIENT\"}" --accountId $MATCHER --deposit 5 --gas=15000000000000`
1. `near call $CONTRACT offerMatchingFunds "{\"recipient\": \"$RECIPIENT\"}" --accountId $MATCHER2 --deposit 1 --gas=15000000000000`
1. `near view $CONTRACT getCommitments "{\"recipient\": \"$RECIPIENT\"}"`
1. `near call $CONTRACT rescindMatchingFunds "{\"recipient\": \"$RECIPIENT\", \"requestedAmount\": \"2000000000000000000000000\"}" --accountId $MATCHER --gas=90000000000000`
1. `near call $CONTRACT donate "{\"recipient\": \"$RECIPIENT\"}" --accountId $DONOR --deposit 4 --gas 300000000000000`
1. `near call $CONTRACT rescindMatchingFunds "{\"recipient\": \"$RECIPIENT\", \"requestedAmount\": 9999}" --accountId $MATCHER --gas=90000000000000`
1. Optionally clean up accounts with:
   ```
   near delete $DONOR $MATCHER
   near delete $RECIPIENT $MATCHER
   near delete $MATCHER2 $MATCHER
   ```
