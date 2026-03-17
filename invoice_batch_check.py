import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp"}
REQUIRED_TOP_LEVEL = [
    "Seller_Name",
    "Seller_GSTIN",
    "Buyer_Name",
    "Buyer_GSTIN",
    "Invoice_No",
    "Invoice_Date",
    "Products",
    "Grand_Total",
]
REQUIRED_PRODUCT_KEYS = [
    "S_No",
    "Name_of_Product",
    "HSN_Code",
    "Qty",
    "Rate",
    "CGST_Percent",
    "SGST_Percent",
    "IGST_Percent",
    "Amount",
]


def iter_images(targets):
    for target in targets:
        path = Path(target)
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
            yield path.resolve()
            continue
        if path.is_dir():
            for child in sorted(path.iterdir()):
                if child.is_file() and child.suffix.lower() in IMAGE_EXTENSIONS:
                    yield child.resolve()


def validate_export(export_path):
    findings = []
    if not export_path.exists():
        return [f"missing export file: {export_path}"]

    try:
        data = json.loads(export_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [f"invalid json: {exc}"]

    for key in REQUIRED_TOP_LEVEL:
        if key not in data:
            findings.append(f"missing top-level key: {key}")

    invoice_date = str(data.get("Invoice_Date", ""))
    if invoice_date and not re.fullmatch(r"\d{2}/\d{2}/\d{4}", invoice_date):
        findings.append(f"non-normalized invoice date: {invoice_date}")

    grand_total = str(data.get("Grand_Total", ""))
    if grand_total and re.fullmatch(r"\d{1,3}\.\d{3}", grand_total):
        findings.append(f"grand total still looks OCR-formatted: {grand_total}")

    products = data.get("Products", [])
    if not isinstance(products, list) or not products:
        findings.append("products list missing or empty")
        return findings

    for index, product in enumerate(products, start=1):
        if not isinstance(product, dict):
            findings.append(f"product {index} is not an object")
            continue
        for key in REQUIRED_PRODUCT_KEYS:
            if key not in product:
                findings.append(f"product {index} missing key: {key}")

        hsn_code = str(product.get("HSN_Code", ""))
        if hsn_code and not re.fullmatch(r"\d{4}|\d{6}|\d{8}", hsn_code):
            findings.append(f"product {index} suspicious HSN: {hsn_code}")

        for amount_key in ("Qty", "Rate", "Amount"):
            raw_value = str(product.get(amount_key, ""))
            if raw_value and re.search(r"[A-Z]", raw_value, re.IGNORECASE):
                findings.append(f"product {index} has OCR noise in {amount_key}: {raw_value}")

    return findings


def main():
    parser = argparse.ArgumentParser(description="Run deep.py against multiple images and validate exported JSON.")
    parser.add_argument("inputs", nargs="+", help="Image files or directories containing invoice images")
    parser.add_argument("--output-root", default="batch_output", help="Root folder for per-image outputs")
    args = parser.parse_args()

    workspace = Path(__file__).resolve().parent
    output_root = (workspace / args.output_root).resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    images = list(iter_images(args.inputs))
    if not images:
        print("No images found.")
        raise SystemExit(1)

    report = []
    for image_path in images:
        image_output_dir = output_root / image_path.stem
        image_output_dir.mkdir(parents=True, exist_ok=True)

        command = [sys.executable, str(workspace / "deep.py"), str(image_path), str(image_output_dir)]
        print(f"\n=== Running {image_path.name} ===")
        result = subprocess.run(command, cwd=str(workspace), capture_output=True, text=True)

        export_path = image_output_dir / "validated_clean.json"
        findings = validate_export(export_path)
        status = "passed" if result.returncode == 0 and not findings else "failed"
        report.append({
            "image": str(image_path),
            "output": str(export_path),
            "status": status,
            "returncode": result.returncode,
            "findings": findings,
            "stdout_tail": result.stdout[-2000:],
            "stderr_tail": result.stderr[-2000:],
        })

        print(f"status: {status}")
        if findings:
            for finding in findings:
                print(f"  - {finding}")

    report_path = output_root / "batch_report.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nSaved report to {report_path}")


if __name__ == "__main__":
    main()