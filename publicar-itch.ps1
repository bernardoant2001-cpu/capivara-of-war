# Manda a versão atual do jogo pro itch.io
# uso: .\publicar-itch.ps1
$ErrorActionPreference = 'Stop'
$alvo = 'nadinh0/capivara-of-war:html'
$pasta = Join-Path $env:TEMP 'capivara-itch-build'

if (Test-Path $pasta) { Remove-Item -Recurse -Force $pasta }
New-Item -ItemType Directory -Force "$pasta\src", "$pasta\assets\fonts" | Out-Null

# só o que o jogo precisa (sem testes, planejamento etc.)
Copy-Item "$PSScriptRoot\index.html" $pasta
Copy-Item "$PSScriptRoot\src\*.js" "$pasta\src"
Get-ChildItem "$PSScriptRoot\assets" -File | Where-Object { $_.Name -match '^(era\d\.(png|json)|bg\d\.webp|ui\.(png|json))$' } | Copy-Item -Destination "$pasta\assets"
Copy-Item "$PSScriptRoot\assets\fonts\*" "$pasta\assets\fonts"

$butler = Get-Command butler -ErrorAction SilentlyContinue
$exe = if ($butler) { $butler.Source } else { "$env:LOCALAPPDATA\butler\butler.exe" }
& $exe push $pasta $alvo --userversion (Get-Date -Format 'yyyy.MM.dd-HHmm')
