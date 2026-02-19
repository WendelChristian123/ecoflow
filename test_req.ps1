$headers = @{
    "Authorization" = "Bearer sb_publishable_J1JA4w7QyZWgEc4aXYE8nA_0NwGYMgt"
    "Content-Type" = "application/json"
}
$body = Get-Content -Raw -Path "temp_payload.json"

try {
    $response = Invoke-RestMethod -Uri "https://fetbelqmlgjvmcondxzk.supabase.co/functions/v1/create-tenant-admin" -Method Post -Headers $headers -Body $body
    Write-Output "SUCCESS"
    Write-Output $response
} catch {
    Write-Output "ERROR"
    Write-Output $_.Exception.Response.StatusCode.value__
    Write-Output $_.Exception.Response.StatusDescription
    Write-Output $_.Exception.Message
}
