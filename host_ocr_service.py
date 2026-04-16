"""
Host-side OCR Service
Runs on Windows machine to execute deep.py and provide validated_clean.json output
Backend (Docker) calls this service via HTTP
"""

import sys
import os
import json
import subprocess
import traceback
import tempfile
import threading
from pathlib import Path
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
import uvicorn

# Add current directory to path so we can import deep
sys.path.insert(0, str(Path(__file__).parent))

app = FastAPI()

# Port for this service
HOST_SERVICE_PORT = 5001

# Paths
INVOICE_DIR = Path(__file__).parent
UPLOADS_DIR = INVOICE_DIR / "uploads"
OUTPUT_DIR = INVOICE_DIR / "output"
DEEP_SCRIPT = INVOICE_DIR / "deep.py"

# Ensure directories exist
UPLOADS_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

print(f"✓ Host OCR Service initialized")
print(f"  INVOICE_DIR: {INVOICE_DIR}")
print(f"  DEEP_SCRIPT: {DEEP_SCRIPT}")
print(f"  OUTPUT_DIR: {OUTPUT_DIR}")


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "host_ocr"}


@app.post("/process")
async def process_image(file: UploadFile = File(...)):
    """
    Process image using deep.py
    - Receives uploaded file from backend
    - Runs deep.py locally
    - Returns validated_clean.json content
    """
    file_path = None
    try:
        # Step 1: Save uploaded file
        filename = file.filename
        suffix = Path(filename).suffix or ".img"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp.close()
        file_path = Path(tmp.name)
        print(f"\n[Host Service] Received: {filename}")
        
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        print(f"[Host Service] Saved to: {file_path}")
        
        # Step 2: Run deep.py
        print(f"[Host Service] Running deep.py with {filename}...")
        
        # Change to invoice directory so deep.py can find its dependencies
        os.chdir(INVOICE_DIR)
        
        # Run deep.py with conda env
        cmd = [
            "python",
            "-u",
            str(DEEP_SCRIPT),
            str(file_path)
        ]
        
        print(f"[Host Service] Command: {' '.join(cmd)}")
        
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=str(INVOICE_DIR),
            bufsize=1
        )

        captured_lines = []

        def stream_output():
            if proc.stdout is None:
                return
            for line in proc.stdout:
                captured_lines.append(line)
                print(line, end="")

        reader = threading.Thread(target=stream_output, daemon=True)
        reader.start()

        try:
            result_code = proc.wait(timeout=1500)
        except subprocess.TimeoutExpired:
            proc.kill()
            reader.join(timeout=5)
            raise

        reader.join(timeout=5)
        print(f"[Host Service] deep.py exit code: {result_code}")
        
        if result_code != 0:
            error_msg = "".join(captured_lines).strip() or "Unknown error"
            print(f"[Host Service] Error output:\n{error_msg}")
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "error": f"deep.py failed with code {result_code}",
                    "details": error_msg[:500],
                    "debug_log": error_msg[:20000]
                }
            )

    except subprocess.TimeoutExpired:
        print("[Host Service] deep.py timed out")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "deep.py timed out",
                "details": "deep.py exceeded host timeout (1500s)"
            }
        )
        
    except Exception as e:
        print(f"[Host Service] Exception: {str(e)}")
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "details": traceback.format_exc()
            }
        )
    finally:
        # Clean up uploaded file to save space
        try:
            if file_path and file_path.exists():
                file_path.unlink()
        except:
            pass

    # Step 3: Read validated_clean.json
    validated_json_path = OUTPUT_DIR / "validated_clean.json"

    if not validated_json_path.exists():
        print(f"[Host Service] ERROR: {validated_json_path} not found!")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "validated_clean.json not generated",
                "details": "deep.py ran but did not produce validated_clean.json"
            }
        )

    with open(validated_json_path, "r", encoding="utf-8") as f:
        validated_data = json.load(f)

    print("[Host Service] Successfully read validated_clean.json")

    global_ocr_path = OUTPUT_DIR / "global_ocr.txt"
    llm_correct_path = OUTPUT_DIR / "llm_correct.txt"

    ocr_text = (
        validated_data.get("original_invoice_text")
        or validated_data.get("ocr_text")
        or ""
    )
    if not ocr_text and global_ocr_path.exists():
        ocr_text = global_ocr_path.read_text(encoding="utf-8", errors="ignore").strip()

    corrected_text = (
        validated_data.get("corrected_invoice_text")
        or validated_data.get("corrected_text")
        or ""
    )
    if not corrected_text and llm_correct_path.exists():
        corrected_text = llm_correct_path.read_text(encoding="utf-8", errors="ignore").strip()
    if not corrected_text and validated_data:
        corrected_text = json.dumps(validated_data, ensure_ascii=False, indent=2)

    return {
        "success": True,
        "source": "deep.py",
        "ocr_text": ocr_text,
        "corrected_text": corrected_text,
        "raw_json": validated_data,
        "debug_log": "".join(captured_lines),
        "correction_success": True,
        "correction_error": None,
        "pipeline_source": "deep.py",
        "deep_error": None,
        "message": "Image processed successfully using deep.py"
    }


if __name__ == "__main__":
    print(f"\n{'='*60}")
    print(f"Host OCR Service")
    print(f"{'='*60}")
    print(f"Starting on http://localhost:{HOST_SERVICE_PORT}")
    print(f"POST /process - Process image with deep.py")
    print(f"GET  /health - Health check")
    print(f"{'='*60}\n")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=HOST_SERVICE_PORT,
        log_level="info"
    )
