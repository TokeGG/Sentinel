---
name: deal-search
description: Find and compare current deals for a product the user names, using the Deals module sources.
module: hub.deals
category: deals
---

# Deal search

1. Ask for (or take from the request) the product, a maximum price and any must-have features.
2. Look through the stored offers from the user's Deals sources first; only suggest adding a new feed if nothing matches.
3. Compare matches by price, seller and how recent the offer is. Ignore offers older than a week unless asked.
4. Answer with at most five options: title, price, seller, link. Say plainly when nothing good was found.
5. Never buy, sign in or enter payment details on the user's behalf.
