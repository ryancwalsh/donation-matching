# Donations With Automatic Matching Up to a Maximum

Someone (let's call them "Matcher") chooses a donation recipient account and says "I'll match donations up to X amount." So he/she sends the max amount to the controlling contract (sort of like escrow).

For simplicity (to avoid complexity of expiration dates and cron jobs and whatever), any Matcher can at any time rescind any unclaimed funds. If the promised funds for that matcher become 0, the matcher is removed (is no longer listed as a matcher related to that recipient).

Any other account (other donors) can choose to donate to the recipient account (via the controlling contract, which is this project).

On each donation:

1. Funds get transferred from donor to recipient.
1. For each and every "matcher" account currently associated with the recipient, the following happens:
   1. The Matcher will automatically also donate to the recipient an amount (called "matchedAmount") that equals the minimum of the donor's donated amount and that matcher's remaining commitment.
   1. The Matcher's commitment will be decreased by that "matchedAmount".

## Usage

1. clone this repo to a local folder
1. run `yarn`
1. `./scripts/1.dev-deploy.sh`
1. Follow the instructions from the output of the previous line. It will tell you to run something like `export CONTRACT=dev-1638053233399-4079004334`.
1. You will need at least 3 other NEAR accounts (which you can create at https://wallet.testnet.near.org/). One to act as a recipient (such as a charity), one to act as a regular donor, and one to act as a "matcher" (someone who commits to match others' donations to a certain recipient).
   1. Consider following the sub-account example at https://docs.near.org/docs/tools/near-cli#near-create-account like `near create-account sub-acct.example-acct.testnet --masterAccount example-acct.testnet --initialBalance 20`
1. Similarly call `export` commands to define RECIPIENT, MATCHER, and DONOR with the accountIds from the previous step.
1. Read https://docs.near.org/docs/tools/near-cli#near-call and decide whether you want to use `--depositYocto` or `--deposit` in the next step.
1. `near call $CONTRACT offerMatchingFunds "{\"recipient\": \"$RECIPIENT\"}" --accountId $MATCHER --deposit 20 --gas=15280193810960`
1. `near call $CONTRACT rescindMatchingFunds "{\"recipient\": \"$RECIPIENT\", \"requestedAmount\": 7}" --accountId $MATCHER --gas=15280193810960`
1. `near call $CONTRACT donate "{\"recipient\": \"$RECIPIENT\"}" --accountId $DONOR --deposit 10 --gas 2528019381096`
1. `near call $CONTRACT rescindMatchingFunds "{\"recipient\": \"$RECIPIENT\", \"requestedAmount\": 9999}" --accountId $MATCHER --gas=15280193810960`
