---
name: coupon-sanity
description: Sort collected promo codes into likely-valid and stale, without trying them on any site.
category: deals
---

# Coupon sanity

1. List the promo-code rows with store, code text and the date seen.
2. Mark codes older than 30 days or with an expiry date passed as stale.
3. Mark codes with conditions (minimum spend, first order) and repeat them.
4. Never submit a code anywhere; this is a reading task only.
5. Return a short table: store, code, status, condition.
