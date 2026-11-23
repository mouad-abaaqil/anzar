"""Sanity table + Jan-2022 check from the series files. Prints markdown."""
import json, statistics as st, collections
OUT = "/Users/mouad/Developer/SRMSM/platform/data-raw/satellite/"
IDS = ["youssef-ben-tachfine", "abdelmoumen", "aoulouz", "moulay-abdellah"]
def med(x): return round(st.median(x), 2) if x else None
print("| dam | scenes | min | median | max | 2025-11 median (n) | 2026-11 median (n) |\n|---|---|---|---|---|---|---|")
for i in IDS:
    s = json.load(open(f"{OUT}{i}-series.json")); a = [r["areaKm2"] for r in s]
    n25 = [r["areaKm2"] for r in s if r["date"].startswith("2025-11")]; n26 = [r["areaKm2"] for r in s if r["date"].startswith("2026-11")]
    print(f"| {i} | {len(s)} | {min(a)} | {med(a)} | {max(a)} | {med(n25)} ({len(n25)}) | {med(n26)} ({len(n26)}) |")
print("\nJan-2022 check (median km2; dates are scene dates)")
print("| dam | 2021-10..12 | 2022-02..04 | step | scenes offset flag False/True | subtracted by us |\n|---|---|---|---|---|---|")
for i in IDS:
    s = json.load(open(f"{OUT}{i}-series.json"))
    a = [r["areaKm2"] for r in s if "2021-10" <= r["date"][:7] <= "2021-12"]; b = [r["areaKm2"] for r in s if "2022-02" <= r["date"][:7] <= "2022-04"]
    c = collections.Counter(r["boaOffsetApplied"] for r in s)
    print(f"| {i} | {med(a)} | {med(b)} | {round(med(b)-med(a),2)} | {c[False]}/{c[True]} | {sum(r['offsetSubtractedByUs'] for r in s)} |")
