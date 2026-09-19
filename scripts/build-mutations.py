#!/usr/bin/env python3
"""
Turn copy/generated/*.json into Shopify Admin API payloads.

Emits two files per batch into copy/payloads/:
  product-update-<n>.json   variables for productUpdate (description + SEO)
  metafields-set-<n>.json   variables for metafieldsSet (vitals.* + custom.feed_title)

metafieldsSet accepts 25 metafields per call, so products are chunked to
two per call (11 metafields each) to stay inside it.

    python3 scripts/build-mutations.py [--dir copy/generated] [--out copy/payloads]
"""
import argparse
import glob
import json
import os

VITALS_KEYS = [
    "tagline",
    "top_benefit_1", "top_benefit_2", "top_benefit_3",
    "key_benefit_1_title", "key_benefit_1_description",
    "key_benefit_2_title", "key_benefit_2_description",
    "key_benefit_3_title", "key_benefit_3_description",
]
# multi_line only where the PDP renders a full sentence
MULTILINE = {"key_benefit_1_description", "key_benefit_2_description", "key_benefit_3_description"}

PRODUCT_UPDATE = """mutation Upd($input: ProductInput!) {
  productUpdate(input: $input) {
    product { id handle seo { title description } }
    userErrors { field message }
  }
}"""

METAFIELDS_SET = """mutation Set($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { key namespace }
    userErrors { field message code }
  }
}"""


def chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="copy/generated")
    ap.add_argument("--out", default="copy/payloads")
    ap.add_argument("--catalogue", default="copy/backup/catalogue-before-2026-09-19.json")
    args = ap.parse_args()

    ids = {r["handle"]: r["id"] for r in json.load(open(args.catalogue))}
    recs = [json.load(open(p)) for p in sorted(glob.glob(os.path.join(args.dir, "*.json")))]
    os.makedirs(args.out, exist_ok=True)

    updates, metafields = [], []
    for r in recs:
        pid = ids[r["handle"]]
        updates.append({
            "input": {
                "id": pid,
                "descriptionHtml": r["descriptionHtml"],
                "seo": {"title": r["seo_title"], "description": r["seo_description"]},
            }
        })
        for k in VITALS_KEYS:
            metafields.append({
                "ownerId": pid, "namespace": "vitals", "key": k,
                "type": "multi_line_text_field" if k in MULTILINE else "single_line_text_field",
                "value": r["vitals"][k],
            })
        metafields.append({
            "ownerId": pid, "namespace": "custom", "key": "feed_title",
            "type": "single_line_text_field", "value": r["feed_title"],
        })

    for i, batch in enumerate(chunks(metafields, 22), 1):
        json.dump({"query": METAFIELDS_SET, "variables": {"metafields": batch}},
                  open(f"{args.out}/metafields-set-{i:02d}.json", "w"), indent=1, ensure_ascii=False)
    for i, u in enumerate(updates, 1):
        json.dump({"query": PRODUCT_UPDATE, "variables": u},
                  open(f"{args.out}/product-update-{i:02d}.json", "w"), indent=1, ensure_ascii=False)

    print(f"{len(updates)} productUpdate payloads, "
          f"{len(metafields)} metafields in {(len(metafields) + 21) // 22} metafieldsSet calls "
          f"-> {args.out}")


if __name__ == "__main__":
    main()
