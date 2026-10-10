# Review request, day 14 after delivery

Source: October audit, S11 "The reviews engine" (page 34), day-14 request email. Send 14 days after the order is **delivered** (not dispatched), from the review app, to every customer whose order was delivered, whatever we think they will say. One email per order; if the order has more than one bed, ask about the first and link to the others.

Placeholders are written as `{{ ... }}`. Map them to the review app's own variables when the flow is set up (Judge.me, Okendo and Loox each name them differently). Lines in square brackets are buttons or conditions, not text.

## Subject

How's {{ dog_name | default: "your dog" }} getting on with {{ product_short_name }}?

## Preview text

Two weeks in. Good or bad, a few lines from you help the next owner choose.

## Body

Hi {{ first_name | default: "there" }},

{{ product_short_name }} arrived two weeks ago. Honest question: is it getting used?

A few lines from you, good or bad, help another owner pick the right bed and the right size. A photo of {{ dog_name | default: "your dog" }} on it helps even more, and if you can tell us their breed, age and weight, the next person with a dog like yours will thank you for it.

[Button: Write a review]

If something isn't right, just reply to this email instead and I'll sort it.

[Only if the order is covered by the 100-night trial (not personalised items made to order):]
You've still got {{ trial_nights_left }} nights of your 100-night trial, so there's no rush to decide.

Abbas, PawLunova

---

PawLunova is a trading name of Yutani Ltd, Bury. abbas@pawlunova.co.uk

## Notes for setting it up

- `product_short_name` is the bed's first name only (Coniston, Grasmere, Ambleside), not the full product title.
- `trial_nights_left` = 100 minus the nights since delivery (86 on day 14). Leave the trial line out for personalised items made to specification, which the refund policy excludes from the trial.
- No incentive is attached to this email, and nothing in it rewards a good rating. The audit suggests an optional thank-you (a £5 donation to a named dog rescue per review). Add it only once a rescue is agreed and named, give it for every review whatever the rating, and label it on each review and on the review policy page (`/pages/review-policy`). Never use a discount or gift for a review.
- Every review that comes back is published whatever the rating (see the review policy). Reply to critical ones first.
- A gentle reminder on day 21 to anyone who hasn't reviewed is fine (audit S11). Stop after that.
