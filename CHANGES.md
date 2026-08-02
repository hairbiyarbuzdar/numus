# Numu — Bug Fixes Log

### Auth

- **Password field missing show/hide (eye) icon** — Fixed. The Login password field has an eye toggle.
- **Sign In button allows multiple clicks** — Fixed. The button disables and shows a spinner while the request is in flight.
- **Reset Password fields missing eye icon** — Fixed. New Password and Confirm Password both have eye toggles.
- **Redirected to Dashboard after password reset** — Fixed. Password reset now returns to Login.
- **Send OTP / Resend OTP buttons allow multiple clicks** — Fixed. Both disable and show a spinner while sending.
- **Multiple Sign Up flow issues (eye icon, OTP button, redirect)** — Fixed. Eye toggles added, the OTP button disables while sending, and registration ends on Login.

### Vendor

- **Vendor registration doesn't enforce profile completion** — Fixed. Vendors go to Complete Profile until an admin approves them, and can't create listings before that.
- **Submit Profile button visible before form is complete** — Fixed. It stays disabled until every required field is valid.
- **Vendor profile submission not reaching backend** — Fixed. Submissions reach the API, and CNIC documents are uploaded as files rather than embedded in the row.
- **Product status field missing in Add Product form** — Fixed. A Status dropdown (Draft, Active, Out of Stock, Inactive, Archived) controls approval and buyer visibility.
- **Search and filter not working, pagination missing on My Products** — Fixed. Search, filters, sorting and paging all run server-side, with rows-per-page and numbered pages.
- **Save Product button allows multiple clicks** — Fixed. It disables, shows a spinner, and a ref guard blocks a second submit in the same tick.
- **Input fields on My Products missing labels** — Fixed. All 19 controls have visible labels bound to their inputs.
- **Vendor cannot edit auction details before bidding starts** — Fixed. Vendors can edit an auction until bidding opens; after that it is read-only and any attempt returns "Auction details cannot be modified after bidding has started." Bids placed before the start time are rejected.
- **Save Auction button allows multiple clicks** — Fixed. Same guard as Save Product, on both Save Auction and Save Changes.
- **Vendor dashboard fetches all module data on login** — Fixed. Products, auctions, orders and users load only when their page is opened, stay cached afterwards, and each module shows a skeleton while loading. Vendors no longer request the user table at all.
- **Vendor Orders module not API-backed** — Fixed. Orders come from the API instead of browser storage, with listing, details, status updates, search, filters and pagination. Vendor order scoping never matched anything before and now does.
- **Vendor Dashboard was only a redirect** — Fixed. /vendor is now a real overview: earnings, pipeline, order counts by status, product and auction totals, items awaiting approval, an attention list, recent orders and auctions ending soonest.

### Admin

- **Auction status badges don't reflect the approval workflow** — Fixed. Badges read Pending until approved, then Active / Ended / Cancelled, or Rejected. Active-auction counts follow the same rule.
- **View Details not opening the auction details modal** — Fixed. The eye icon opens a full auction detail modal including prices, dates, images, winner and bid history.
- **Auctions page missing pagination, search and filtering** — Fixed. Search by auction ID, product, vendor or category, filter by status, date range and category, sort and page — all server-side.

### Buyer

- **Marketplace search and filter are not working** — Fixed. Search and the category, vendor, availability, price and auction-status filters all drive server-side queries and combine with each other.
- **Marketplace sections incomplete and missing pagination** — Fixed. All Products shows the full catalogue, Featured is a separate shelf, and All Products, Live Auctions and Wholesale each paginate independently.
- **Profile Settings menu redirects to an incorrect route** — Fixed. The profile menu goes to the signed-in role's own settings page.
- **"Add to Order" button misaligned with the Quantity field** — Fixed. The field and the button share one height and sit on the same baseline.
- **"Add to Order" should become "View Cart" after adding** — Fixed. After a successful add the button becomes View Cart and opens the cart; changing the quantity switches it back.
- **City field UI inconsistent with the other inputs (Safari)** — Fixed. The City dropdown matches the inputs beside it, with a centred icon and a chevron. The same fix was applied to the registration form.
- **Checkout Order Summary lines are ambiguous** — Fixed. Each line shows unit price and vendor, so two listings sharing a name are distinguishable.
- **Order submission not persisted to the backend** — Fixed. Placing an order sends a real API request and the order is saved in the database; order lists and statuses are read back from the API instead of browser storage.
- **Attachments stored as base64 instead of uploaded files** — Fixed. Product images, auction images and vendor CNIC documents are uploaded to the server and only their URL is stored in the database. Existing base64 rows are converted by a migration that runs on deploy.
- **Cart stored in browser local storage instead of the database** — Fixed. Adding, updating, removing and clearing the cart all hit the API and persist per user, so a basket follows the buyer across devices and sessions. Signed-out visitors keep a local basket that is merged into their account on sign-in. Prices are read from the product on load, so a saved cart never shows a stale price.
- **Wishlist stored in browser local storage instead of the database** — Fixed. Adding and removing wishlist items call the API and persist per user, and the list is loaded from the backend on login or when the Wishlist page opens. Anything saved in the browser beforehand is merged in once.
- **Buyer Auctions page missing pagination, search and filtering** — Fixed. The auctions page now searches by auction, vendor or category, filters by status (Live now / Upcoming / Ended), category and starting price, sorts by ending time or bid, and pages through results — all server-side. Placing a bid refreshes the list and the button is guarded against double clicks.
- **Cancelled auctions were visible to buyers** — Fixed. Withdrawn auctions were filtered out in the browser, which stopped working once listings were paged server-side; the API now excludes them from every buyer listing.
- **Buyer portal fetched all module data on login** — Fixed. Cart, wishlist, orders, marketplace and auctions each load when their page is opened and are cached afterwards, with their own loading state. Only a single small counts request runs at sign-in, to keep the cart and wishlist badges in the header correct.
- **Unverified buyers could place bids** — Fixed. Bidding requires a verified account: the API rejects the bid with a message asking the buyer to verify, and the bid form is replaced by that message. A bid is also now recorded against the signed-in account rather than whatever the request claimed, so one buyer cannot bid in another’s name.
