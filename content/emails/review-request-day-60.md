# Review follow-up, day 60 after delivery

Source: October audit, S11 "The reviews engine" (page 34), day-60 follow-up ("long-term proof"). Send 60 days after the order is **delivered**, from the review app, to every customer, whether or not they reviewed at day 14 and whatever rating they gave. Long-term reviews are the ones owners trust most, because they answer "does it go flat?".

Placeholders are written as `{{ ... }}`; map them to the review app's own variables. Lines in square brackets are buttons or conditions, not text. There are two versions of the middle paragraph: one for people who have already reviewed, one for people who haven't.

## Subject

Two months on: is {{ product_short_name }} holding up?

## Preview text

A quick one. Two months in, how's the bed holding up, and is it still theirs?

## Body

Hi {{ first_name | default: "there" }},

Quick one: two months in, how's {{ product_short_name }} holding up, and is {{ dog_name | default: "your dog" }} still using it?

[If they reviewed at day 14:]
You were kind enough to review it when it arrived. If anything has changed since, better or worse, you can add an update to your review. It shows with today's date, next to what you wrote before.

[Button: Add an update]

[If they haven't reviewed yet:]
If you have a minute, a few lines about how it's doing after two months would help another owner more than almost anything we could write. Good or bad, it all goes up.

[Button: Write a review]

And if anything's wrong, just reply here and I'll sort it.

[Only if the order is covered by the 100-night trial (not personalised items made to order):]
You've still got {{ trial_nights_left }} nights of your 100-night trial.

Abbas, PawLunova

---

PawLunova is a trading name of Yutani Ltd, Bury. abbas@pawlunova.co.uk

## Notes for setting it up

- `trial_nights_left` = 100 minus the nights since delivery (40 on day 60). Leave the line out for personalised items made to specification.
- Ask about "the bed", not "the foam": some beds are fibre-filled or mesh. If the review app can branch on the product's `custom.core_type` metafield, foam beds may say "how's the foam holding up" instead.
- No incentive is attached to this email, and nothing in it rewards a good rating. If a thank-you is ever introduced, it must be the same for every review whatever the rating, and labelled (see `/pages/review-policy`).
- Send it once. No reminder for the day-60 email.
