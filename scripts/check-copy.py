#!/usr/bin/env python3
"""
Validate generated product copy before it is pushed to Shopify.

Reads copy/generated/*.json (one file per product, written by the copy
workflow) and checks each one against the rules the brief is held to:
character budgets, allowed HTML, required blocks, banned claims, and
cross-product duplication.

Exit code 1 if any ERROR is raised. WARNINGs never fail the run.

    python3 scripts/check-copy.py [--dir copy/generated] [--baseline copy/backup/descriptions-before-2026-09-19.json]
"""
import argparse
import glob
import html
import json
import os
import re
import sys
from collections import Counter, defaultdict

# --- budgets -----------------------------------------------------------------
# seo title: Google truncates around 580px; 60 characters is the safe ceiling.
# seo description: 155 characters before the ellipsis on desktop.
# feed title: Google Merchant Center hard limit is 150.
LIMITS = {
    "seo_title": (35, 60),
    "seo_description": (120, 155),
    "feed_title": (70, 150),
    "tagline": (20, 90),
    "top_benefit": (15, 75),
    "key_benefit_title": (8, 42),
    "key_benefit_description": (40, 170),
}
WORDS = (380, 820)  # a 7-question FAQ costs ~200 words on top of the body

ALLOWED_TAGS = {
    "div", "h2", "h3", "h4", "p", "ul", "ol", "li", "strong", "em", "br",
    "a", "table", "thead", "tbody", "tr", "th", "td", "span",
}

VITALS_KEYS = [
    "tagline",
    "top_benefit_1", "top_benefit_2", "top_benefit_3",
    "key_benefit_1_title", "key_benefit_1_description",
    "key_benefit_2_title", "key_benefit_2_description",
    "key_benefit_3_title", "key_benefit_3_description",
]

# --- claims we may never make ------------------------------------------------
# CAP Code: a bed is not a medical device, so no outcome may be promised.
# DMCC Act 2024 / CMA: no invented urgency, no fabricated social proof.
BANNED = [
    (r"\bcures?\b|\bcuring\b", "medical claim: cure"),
    (r"\bheals?\b|\bhealing\b", "medical claim: heal"),
    (r"\btreat(?:s|ing)?\s+(?:\w+\s+){0,2}?"
     r"(?:arthritis|pain|joints?|hips?|elbows?|dysplasia|inflammation|symptoms?|"
     r"stiffness|soreness|a condition)\b"
     r"|\btreatment for\b", "medical claim: treat"),
    (r"pain[- ]free|relieves? (?:all )?pain|eliminates? pain|takes? (?:the |their )?pain away", "medical claim: pain"),
    (r"\bclinically\b|\bmedically\b|\bveterinary[- ]grade\b|\bvet[- ]approved\b|\bprescribed\b", "unsubstantiated authority claim"),
    (r"\bcertified orthopaedic\b|\bmedical[- ]grade\b", "unsubstantiated authority claim"),
    (r"\bfixes?\b\s+(?:their|his|her|the)\s+(?:arthritis|hips|joints|dysplasia)", "medical claim: fixes"),
    (r"\bguaranteed to (?:stop|cure|fix|end|heal)\b", "absolute outcome promise"),
    (r"\bmiracle\b|\bmagic(?:al)?\b", "puffery bordering on a claim"),
    (r"\bonly \d+ left\b|\bselling fast\b|\bhurry\b|\bact now\b|\bdon.t miss out\b", "manufactured urgency"),
    (r"\b\d+ (?:people|owners|others) (?:are )?(?:viewing|looking|bought)\b", "manufactured social proof"),
    (r"\b(?:\d[\d,]*\+? )?(?:verified )?reviews?\b(?=.{0,40}\b(?:4\.\d|5)\s*/?\s*5)", "review count in body copy (store has none published)"),
    (r"\bbest dog bed (?:in|on) the (?:uk|world|market)\b", "unverifiable superlative"),
    (r"\b100% (?:waterproof|chew[- ]proof|indestructible)\b", "absolute product claim"),
    (r"\bindestructible\b|\bchew[- ]proof\b", "absolute durability claim"),
]

# Marketing filler the customer never uses. Warn, do not fail.
FILLER = [
    "premium quality", "high quality", "state of the art", "cutting edge",
    "unparalleled", "unrivalled", "game changer", "revolutionary",
    "look no further", "we are proud to", "crafted with love",
    "perfect for all dogs", "one size fits all", "luxurious comfort",
]

# Blocks every description has to keep, because they carry the terms.
REQUIRED_PATTERNS = [
    (r"/policies/refund-policy", "link to the returns and guarantee terms"),
    (r"/policies/shipping-policy", "link to the delivery policy"),
    (r"100[- ]night", "the 100-night trial"),
]

# Sentences the whole catalogue is MEANT to share: the trial and guarantee
# terms, the delivery line, the vet line, the care instruction, the measuring
# rule and the FAQ spine. These are matched on the rendered text, because the
# duplication check runs after tags are stripped and the policy hrefs are gone
# by then. Anything NOT on this list that turns up on three or more products is
# accidental, and accidental duplication across near-identical beds is the one
# thing most likely to get this catalogue treated as thin content.
# The seven-question spine from the brief. Matched loosely, because the wording
# of a question is allowed to suit its product; what is not allowed is dropping one.
FAQ_SPINE = [
    ("sizing", r"which size|what size|size to get|size do I"),
    ("delivery", r"delivery|how quickly|how long.{0,20}(arrive|take)|when.{0,15}arrive"),
    ("instalments", r"instalment|installment|klarna|pay in 3|spread the cost"),
    ("product-specific", r"<h3>[^<]{10,}\?</h3>"),
    ("older dog", r"older dog|ageing dog|aging dog|stiff|finds it hard to get up|senior"),
    ("washing", r"wash"),
    ("won't use it", r"(won.t|will not|does not|doesn.t) (use|settle|take to)"),
]

BOILERPLATE_STEMS = (
    # trial, guarantee and returns
    "read the full returns and guarantee terms",
    "one trial per household",
    "we arrange free uk mainland collection",
    "we collect it free from the uk mainland",
    "try it at home for 100 nights",
    "that is what the 100 nights are for",
    "no-flatten guarantee under normal domestic use",
    "in addition to your statutory rights",
    # delivery
    "free standard uk delivery on orders over",
    "check delivery timings and any product-specific lead time",
    # the vet line
    "speak to your vet about the right resting surface",
    "a bed is for comfort",
    # care
    "sewn-in care label",
    "sewn-in label",
    "sewn-in washing instructions",
    "never wash or soak the foam",
    "the cover unzips and takes a 30",
    "leather handles have their own care instructions",
    "air-dry",
    # sizing help
    "measure your dog",
    "message us their breed and weight",
    "outside measurement",
    "take up part of the outside footprint",
    "the bolsters take up",
    # outdoor, kennel and travel safety terms. These are the ones that most need
    # to read the same on every product that carries them: a supervision warning
    # or a returns window rewritten for freshness is a worse warning.
    "supervise your dog",
    "does not prevent overheating",
    "shade and water still matter",
    "enter, stand, turn and lie",
    "internal resting area",
    "30-day change-of-mind",
    "not covered by the 100-night sleep trial",
    "not a vehicle restraint",
    "contact us for the exact dimensions",
    "wipe the shell with a damp cloth",
    # the FAQ spine, which the brief keeps identical on all 64 for the schema
    "how do i know which size to get",
    "how much is delivery",
    "can i pay in instalments",
    "will it suit an older dog",
    "can i actually wash it",
    "what if my dog just",
)

# A sentence may legitimately appear on this many products before it counts as
# accidental. Two beds in the same family landing on one shared line is noise;
# three is a pattern.
MAX_SHARED = 2


def strip_tags(s: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", " ", s))


def text_of(html_str: str) -> str:
    return re.sub(r"\s+", " ", strip_tags(html_str)).strip()


def sentences(text: str):
    for raw in re.split(r"(?<=[.!?])\s+", text):
        s = raw.strip()
        if len(s.split()) >= 8:
            yield s


def check_html(h: str, err, warn):
    tags = re.findall(r"<\s*(/?)\s*([a-zA-Z0-9]+)", h)
    stack = []
    void = {"br", "img", "hr"}
    for closing, name in tags:
        name = name.lower()
        if name not in ALLOWED_TAGS:
            err(f"disallowed HTML tag <{name}>")
            continue
        if name in void:
            continue
        if closing:
            if not stack or stack[-1] != name:
                err(f"unbalanced HTML around </{name}>")
                return
            stack.pop()
        else:
            stack.append(name)
    if stack:
        err(f"unclosed HTML tag(s): {', '.join(stack)}")
    if not re.match(r"\s*<div class=\"pawlunova-product-copy\">", h):
        err('description must open with <div class="pawlunova-product-copy">')
    # pl-rte-clean splits the description on the literal string "<h2>", so an
    # <h2 class="..."> is invisible to it: not dropped, not re-emitted, just
    # passed through raw. Every h2 here has to be a bare one.
    bare = len(re.findall(r"<h2>", h))
    anyh2 = len(re.findall(r"<h2\b", h))
    if anyh2 != bare:
        err("an <h2> carries an attribute; the theme only recognises a bare <h2>")
    if not (1 <= bare <= 3):
        err(f"description has {bare} <h2> headings, outside the 1-3 the brief's spine allows")
    if re.search(r"<h1", h):
        err("description must not contain an <h1> — the theme renders the product title as the H1")

    # The FAQPage schema is the one structural advantage this catalogue has over
    # every competitor in the teardown, and it only pays if the questions are there.
    missing_q = [label for label, pattern in FAQ_SPINE if not re.search(pattern, h, re.I)]
    if missing_q:
        err(f"FAQ is missing {len(missing_q)} of the 7 questions: {', '.join(missing_q)}")


def band(name, value, err, key=None):
    lo, hi = LIMITS[key or name]
    n = len(value)
    if n < lo:
        err(f"{name} is {n} chars, below the {lo} floor")
    if n > hi:
        err(f"{name} is {n} chars, over the {hi} ceiling: {value[:80]}…")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="copy/generated")
    ap.add_argument("--baseline", default="copy/backup/descriptions-before-2026-09-19.json")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    files = sorted(glob.glob(os.path.join(args.dir, "*.json")))
    if not files:
        print(f"no copy files in {args.dir}", file=sys.stderr)
        return 1

    baseline = {}
    if os.path.exists(args.baseline):
        baseline = {r["handle"]: r for r in json.load(open(args.baseline))}

    errors = defaultdict(list)
    warnings = defaultdict(list)
    boilerplate_hits = Counter()
    sentence_owner = defaultdict(set)
    seo_titles, feed_titles, taglines = Counter(), Counter(), Counter()
    docs = []

    for path in files:
        rec = json.load(open(path))
        h = rec.get("handle") or os.path.basename(path)[:-5]
        err = lambda m, h=h: errors[h].append(m)
        warn = lambda m, h=h: warnings[h].append(m)
        docs.append(rec)

        for field in ("seo_title", "seo_description", "feed_title", "descriptionHtml", "vitals"):
            if not rec.get(field):
                err(f"missing {field}")
        if errors[h]:
            continue

        band("seo_title", rec["seo_title"], err)
        band("seo_description", rec["seo_description"], err)
        band("feed_title", rec["feed_title"], err)

        if not rec["seo_title"].rstrip().endswith("| PawLunova"):
            err("seo_title must end with '| PawLunova'")
        if "PawLunova" not in rec["feed_title"]:
            err("feed_title must carry the brand")

        v = rec["vitals"]
        for k in VITALS_KEYS:
            if not v.get(k):
                err(f"missing vitals.{k}")
                continue
            key = ("tagline" if k == "tagline"
                   else "top_benefit" if k.startswith("top_benefit")
                   else "key_benefit_title" if k.endswith("_title")
                   else "key_benefit_description")
            band(f"vitals.{k}", v[k], err, key=key)
        if v.get("tagline"):
            taglines[v["tagline"].lower()] += 1

        # A price inside a metafield goes stale silently, because it is edited
        # somewhere other than the price. That is exactly how Melbreak ended up
        # advertising £195 on a £155 bed. Prices belong in the body, where the
        # per-night reframe needs them and where this check can see them.
        for field, value in list(v.items()) + [(f"product_highlights[{i}]", x)
                                               for i, x in enumerate(rec["product_highlights"])]:
            if re.search(r"£\s?\d", value or ""):
                err(f"{field} contains a price, which will go stale: {value[:60]}…")

        hl = rec.get("product_highlights") or []
        if len(hl) != 4:
            err(f"{len(hl)} product highlights; the theme shows at most 4 and hides the block below 2")
        for i, x in enumerate(hl):
            if "," in x:
                err(f'highlight {i+1} contains a comma, which splits it into two bullets: "{x}"')
            if "~~" in x:
                err(f"highlight {i+1} contains the theme's internal separator '~~'")
            if re.search(r"[<>&]", x):
                err(f"highlight {i+1} contains markup or an entity, which renders literally: {x[:50]}")
            if not (25 <= len(x) <= 100):
                err(f"highlight {i+1} is {len(x)} chars, outside 25-100: {x[:50]}")

        bg = rec.get("breed_guide") or ""
        if bg:
            if bg[0].isupper():
                err(f'breed_guide must be a lower-case fragment — the theme writes "Typically suits {bg[:40]}…"')
            if bg.rstrip().endswith("."):
                err("breed_guide must not end with a full stop; the theme adds one")

        body = rec["descriptionHtml"]
        check_html(body, err, warn)
        text = text_of(body)
        wc = len(text.split())
        if not (WORDS[0] <= wc <= WORDS[1]):
            err(f"description is {wc} words, outside {WORDS[0]}–{WORDS[1]}")

        haystack = " ".join([text.lower(), rec["seo_description"].lower(),
                             " ".join(v.get(k, "") for k in VITALS_KEYS).lower()])
        for pattern, label in BANNED:
            m = re.search(pattern, haystack, re.I)
            if m:
                err(f"banned claim ({label}): …{haystack[max(0, m.start()-45):m.end()+45]}…")
        for phrase in FILLER:
            if phrase in haystack:
                warn(f"marketing filler: '{phrase}'")
        for pattern, label in REQUIRED_PATTERNS:
            if not re.search(pattern, body, re.I):
                err(f"description is missing {label}")

        # Every size the shopper can buy should be findable in the copy.
        for size in rec.get("must_mention", []):
            if size.lower() not in text.lower():
                warn(f"size/option '{size}' is not mentioned in the description")

        for s in sentences(text):
            low = s.lower()
            if any(stem in low for stem in BOILERPLATE_STEMS):
                boilerplate_hits[h] += 1
                continue
            sentence_owner[re.sub(r"[^a-z0-9 ]", "", low)].add(h)

        seo_titles[rec["seo_title"].lower()] += 1
        feed_titles[rec["feed_title"].lower()] += 1

        if h in baseline:
            old = text_of(baseline[h]["descriptionHtml"])
            if text.strip() == old.strip():
                err("description is byte-identical to the old one — nothing was rewritten")

    # cross-product duplication, boilerplate already excluded
    shared = []
    for key, owners in sentence_owner.items():
        if len(owners) > MAX_SHARED:
            shared.append((len(owners), key))
            for h in owners:
                errors[h].append(f"sentence shared with {len(owners)-1} other products: '{key[:70]}…'")
    for counter, label in ((seo_titles, "seo_title"), (feed_titles, "feed_title"), (taglines, "vitals.tagline")):
        for value, n in counter.items():
            if n > 1:
                for rec in docs:
                    got = rec["seo_title"] if label == "seo_title" else (
                        rec["feed_title"] if label == "feed_title" else rec["vitals"].get("tagline", ""))
                    if got.lower() == value:
                        errors[rec["handle"]].append(f"duplicate {label} shared by {n} products")

    n_err = sum(len(v) for v in errors.values())
    n_warn = sum(len(v) for v in warnings.values())

    if not args.quiet:
        for h in sorted(set(list(errors) + list(warnings))):
            if errors[h] or warnings[h]:
                print(f"\n{h}")
                for m in errors[h]:
                    print(f"  ERROR  {m}")
                for m in warnings[h]:
                    print(f"  warn   {m}")

    uniq = len(sentence_owner)
    dup_sentences = sum(1 for _, o in sentence_owner.items() if len(o) > 1)
    print(f"\n{len(files)} products checked — {n_err} errors, {n_warn} warnings")
    print(f"{uniq} distinct non-boilerplate sentences, {dup_sentences} of them on more than one "
          f"product, {len(shared)} on more than {MAX_SHARED}")
    return 1 if n_err else 0


if __name__ == "__main__":
    sys.exit(main())
