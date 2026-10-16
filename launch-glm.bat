@echo off
setlocal
set ANTHROPIC_BASE_URL=https://api.gonkarouter.io/v1
set ANTHROPIC_API_KEY=sk-VGwsClDXQpEXQhbF4Tkb4Y77cQEwuWQeLc4htOHZ2uZmMHXM
set ANTHROPIC_MODEL=zai-org/GLM-5.3-Flash
echo Launching Claude Code with GLM 5.3 Flash on GonkaRouter...
claude %*
