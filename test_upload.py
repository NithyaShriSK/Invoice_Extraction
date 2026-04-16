import requests
import json
from datetime import datetime

# Use unique email based on timestamp
timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
email = f"test_{timestamp}@example.com"

# Register user
register_url = "http://localhost:8000/auth/register"
register_data = {
    "full_name": "Test User",
    "email": email,
    "password": "test123456"
}

reg_response = requests.post(register_url, json=register_data)
print("Register Status:", reg_response.status_code)
print("Register Response:", reg_response.json())

if reg_response.status_code == 200:
    token = reg_response.json().get("access_token")
    print(f"\n✓ Got token: {token[:50]}...")
    
    # Now test upload with valid token
    upload_url = "http://localhost:8000/upload/file"
    file_path = "invoice1.png"
    
    with open(file_path, 'rb') as f:
        files = {'file': (file_path, f, 'image/png')}
        headers = {'Authorization': f'Bearer {token}'}
        upload_response = requests.post(upload_url, files=files, headers=headers)
    
    print(f"\nUpload Status: {upload_response.status_code}")
    print("\nUpload Response:")
    print(json.dumps(upload_response.json(), indent=2))
