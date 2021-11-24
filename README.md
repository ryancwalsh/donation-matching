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
1. You will need at least 3 NEAR accounts (which you can create at https://wallet.testnet.near.org/). One to act as a recipient (such as a charity), one to act as a regular donor, and one to act as a "matcher" (someone who commits to match others' donations to a certain recipient).
1. [TODO: Other steps are still to be determined.]
