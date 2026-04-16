import os
import subprocess
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python run_image_pipeline.py <image_path>")
        return 1

    image_path = Path(sys.argv[1]).resolve()
    if not image_path.exists():
        print(f"ERROR: Image not found: {image_path}")
        return 1

    env = os.environ.copy()
    env["IMAGE_FILE"] = str(image_path)

    print(f"=== Running deep.py on: {image_path} ===")
    subprocess.run([sys.executable, "deep.py", str(image_path)], check=True, env=env)

    print("=== Running llm_correct.py to produce output/validated_clean.json ===")
    subprocess.run([sys.executable, "llm_correct.py"], check=True, env=env)

    output_file = Path("output") / "validated_clean.json"
    if output_file.exists():
        print(f"=== Done. Corrected JSON written to: {output_file} ===")
        return 0

    print("ERROR: llm_correct.py finished but output/validated_clean.json was not created.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
