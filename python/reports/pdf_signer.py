"""Digital Cryptographic Stamping for PDF Reports."""

import hashlib
import time
from datetime import datetime, timezone

def generate_digital_signature(pdf_bytes: bytes, engineer_id: str = "ENG-DEFAULT") -> dict[str, str]:
    """
    Generates a cryptographic hash signature for a PDF document.
    In a full production environment, this would use pyHanko or PKCS#11 
    to physically embed an X.509 certificate into the PDF blob.
    For this implementation, we generate an immutable SHA-256 seal.
    """
    # 1. Generate SHA-256 hash of the PDF byte contents
    sha256_hash = hashlib.sha256(pdf_bytes).hexdigest()
    
    # 2. Generate a secure timestamp
    timestamp = datetime.now(timezone.utc).isoformat()
    
    # 3. Create a unique document ID based on time and hash
    doc_id = f"INFRA-{int(time.time())}-{sha256_hash[:8].upper()}"
    
    return {
        "document_id": doc_id,
        "hash": sha256_hash,
        "timestamp": timestamp,
        "engineer_id": engineer_id,
        "seal_text": f"Digitally Sealed\nDoc ID: {doc_id}\nHash: {sha256_hash[:16]}...\nBy: {engineer_id}\nTime: {timestamp}"
    }

def append_visual_seal_to_pdf(pdf_bytes: bytes, signature_data: dict[str, str]) -> bytes:
    """
    Appends a visual text seal to the end of a PDF (Mocked).
    In reality, we will just add the seal_text as a Paragraph during the ReportLab generation
    instead of post-processing the raw bytes.
    """
    return pdf_bytes
