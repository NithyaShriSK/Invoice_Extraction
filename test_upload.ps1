$token = "test_token_123"
$filePath = "invoice1.png"
$uri = "http://localhost:8000/upload/file"

$form = @{
    file = Get-Item -Path $filePath
}

$response = Invoke-WebRequest -Uri $uri `
    -Method Post `
    -Form $form `
    -Headers @{Authorization = "Bearer $token"} `
    -ContentType "multipart/form-data"

$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
