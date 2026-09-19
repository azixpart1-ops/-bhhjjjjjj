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
WORDS = (330, 780)

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
    (r"\btreats?\b(?!\s+(?:them|him|her|your dog)\b)|\btreating\b|\btreatment for\b", "medical claim: treat"),
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

BOILERPLATE_HINTS = (
    "policies/refund-policy",
    "policies/shipping-policy",
    "speak to your vet",
    "sewn-in care label",
    "free standard uk delivery",
)


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
    if len(re.findall(r"<h2", h)) != 1:
        err("description needs exactly one <h2>")
    if re.search(r"<h1", h):
        err("description must not contain an <h1> — the theme renders the product title as the H1")


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
            key = re.sub(r"[^a-z0-9 ]", "", s.lower())
            if any(hint in key for hint in
                   (b.replace("/", "").replace("-", "") for b in BOILERPLATE_HINTS)):
                continue
            if any(hint in s.lower() for hint in BOILERPLATE_HINTS):
                continue
            sentence_owner[key].add(h)

        seo_titles[rec["seo_title"].lower()] += 1
        feed_titles[rec["feed_title"].lower()] += 1

        if h in baseline:
            old = text_of(baseline[h]["descriptionHtml"])
            if text.strip() == old.strip():
                err("description is byte-identical to the old one — nothing was rewritten")

    # cross-product duplication
    for key, owners in sentence_owner.items():
        if len(owners) > 2:
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

    print(f"\n{len(files)} products checked — {n_err} errors, {n_warn} warnings")
    return 1 if n_err else 0


if __name__ == "__main__":
    sys.exit(main())
