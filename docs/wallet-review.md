# What we tell the wallet reviewers

Google asks this at publishing-access time and Apple asks something similar.
Both answers have to stay true to what `packages/passes/src/google.ts` actually
sends, so if the pass gains or loses a field, this file changes with it.

## Use case (Google Wallet publishing access)

Repio is a digital loyalty stamp card for small independent shops in Canada —
cafes, bakeries, bubble tea shops, barbers. It replaces the paper punch card
they hand out today. The shop pays us a flat monthly fee; the card is free to
the customer.

The shop shows a QR code at the counter. A customer scans it, lands on our
join page, and taps "Add to Google Wallet" — one LoyaltyObject per customer per
shop. At the till, staff scan the customer's pass on the shop's own phone to
add a stamp. At the shop's chosen total (usually 9 or 10) the card reads READY
and staff redeem the reward, resetting the count.

On the pass: the shop's name and logo, stamp progress in loyaltyPoints ("4 /
9"), a heroImage of the stamp grid, the reward and the location name as text
modules, and a QR barcode holding an opaque random token that only our scanner
can use. No personal data is encoded in it.

The pass shows no customer name, phone, email or payment information — nothing
on its face identifies the holder. We PATCH only loyaltyPoints and heroImage,
after each stamp or redemption.

Privacy policy: https://tryrepio.com/privacy
Terms: https://tryrepio.com/terms
