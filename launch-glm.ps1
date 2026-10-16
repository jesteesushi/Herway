$env:ANTHROPIC_BASE_URL = "https://api.gonkarouter.io/v1"
$env:ANTHROPIC_API_KEY = "sk-VGwsClDXQpEXQhbF4Tkb4Y77cQEwuWQeLc4htOHZ2uZmMHXM"
$env:ANTHROPIC_MODEL = "zai-org/GLM-5.3-Flash"
Write-Host "Launching Claude Code with GLM-5.3-Flash via GonkaRouter..." -ForegroundColor Green
claude @args
