# Teste do lado Windows (Criar-Vm.ps1). Executa o script como processo filho e
# confere stdout e codigo de saida. Arquivo so com ASCII (PS 5.1 le sem BOM como ANSI).
$ErrorActionPreference = 'Stop'
$criar = Join-Path (Split-Path $PSScriptRoot -Parent) 'host\Criar-Vm.ps1'
$falhas = 0

function Roda {
    param([string[]]$Argumentos)
    $saida = (& powershell -NoProfile -ExecutionPolicy Bypass -File $criar @Argumentos 2>&1 | Out-String)
    return [pscustomobject]@{ Saida = $saida; Codigo = $LASTEXITCODE }
}
function Afirma {
    param([bool]$Condicao, [string]$Msg)
    if ($Condicao) { Write-Host "PASSOU: $Msg" }
    else { Write-Host "FALHOU: $Msg"; $script:falhas++ }
}

if (-not (Test-Path $criar)) {
    Write-Host "FALHOU: Criar-Vm.ps1 inexistente em $criar"
    exit 1
}

# 1. DryRun do Subir
$r = Roda @('-Acao', 'Subir', '-DryRun')
Afirma ($r.Codigo -eq 0) 'Subir -DryRun sai 0'
foreach ($trecho in @('-accel whpx,kernel-irqchip=off', '-m 4096', '-smp 4',
        'hostfwd=tcp:127.0.0.1:8080-:80', 'hostfwd=tcp:127.0.0.1:2222-:22',
        'ds=nocloud;s=http://10.0.2.2:8088/', 'if=virtio')) {
    Afirma ($r.Saida.Contains($trecho)) "DryRun contem '$trecho'"
}
$r = Roda @('-Acao', 'Subir', '-DryRun', '-Acel', 'tcg')
Afirma (-not $r.Saida.Contains('whpx')) 'com -Acel tcg nao contem whpx'
Afirma ($r.Saida.Contains('-accel tcg')) 'com -Acel tcg contem -accel tcg'
$r = Roda @('-Acao', 'Subir', '-DryRun', '-PortaHttp', '9090')
Afirma ($r.Saida.Contains('127.0.0.1:9090-:80')) 'com -PortaHttp 9090 contem 127.0.0.1:9090-:80'

# 2. Porta ocupada: erro claro, exit 2, antes de procurar o QEMU
$vazia = Join-Path ([IO.Path]::GetTempPath()) ('ampara-qemu-vazio-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $vazia | Out-Null
$ouvinte = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Parse('127.0.0.1'), 18099)
$ouvinte.Start()
try {
    $r = Roda @('-Acao', 'Subir', '-PortaHttp', '18099', '-QemuDir', $vazia)
    Afirma ($r.Codigo -eq 2) "porta ocupada sai 2 (obtido $($r.Codigo))"
    Afirma ($r.Saida.Contains('Porta 18099 em uso')) 'porta ocupada diz "Porta 18099 em uso"'
}
finally {
    $ouvinte.Stop()
    Remove-Item -Recurse -Force $vazia -ErrorAction SilentlyContinue
}

# 3. Seed: user-data sem BOM, sem CR, sem marcador residual
$tmp = Join-Path ([IO.Path]::GetTempPath()) ('ampara-seed-' + [guid]::NewGuid().ToString('N'))
try {
    $r = Roda @('-Acao', 'Preparar', '-SomenteSeed', '-DiretorioVm', $tmp, '-RepoUrl', 'https://example.invalid/x.git')
    Afirma ($r.Codigo -eq 0) "Preparar -SomenteSeed sai 0 (obtido $($r.Codigo))"
    $ud = Join-Path $tmp 'seed\user-data'
    Afirma (Test-Path $ud) 'seed\user-data existe'
    if (Test-Path $ud) {
        $bytes = [IO.File]::ReadAllBytes($ud)
        $cab = [Text.Encoding]::ASCII.GetString($bytes, 0, [Math]::Min(13, $bytes.Length))
        Afirma ($cab -eq '#cloud-config') 'user-data comeca com #cloud-config (sem BOM)'
        Afirma (-not ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)) 'user-data sem BOM EF BB BF'
        Afirma (-not ($bytes -contains 13)) 'user-data sem CR'
        $txt = [Text.Encoding]::UTF8.GetString($bytes)
        Afirma (-not $txt.Contains('__')) 'user-data sem marcador __ residual'
        Afirma ($txt.Contains('ssh-ed25519')) 'user-data contem ssh-ed25519'
        Afirma ($txt.Contains('https://example.invalid/x.git')) 'user-data contem a URL do repositorio'
        Afirma ($txt.Contains('http://10.0.2.2:8088/ampara.tar.gz')) 'user-data aponta o tar.gz na porta do seed'
    }
    foreach ($f in @('meta-data', 'vendor-data')) {
        $p = Join-Path $tmp "seed\$f"
        Afirma (Test-Path $p) "seed\$f existe"
        if (Test-Path $p) {
            Afirma (-not ([IO.File]::ReadAllBytes($p) -contains 13)) "seed\$f sem CR"
        }
    }
    $tar = Join-Path $tmp 'seed\ampara.tar.gz'
    Afirma ((Test-Path $tar) -and ((Get-Item $tar).Length -gt 0)) 'seed\ampara.tar.gz existe e nao esta vazio'
    Afirma (Test-Path (Join-Path $tmp 'id_ed25519')) 'chave id_ed25519 gerada'
}
finally {
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}

# 4. Ssh e Sincronizar em DryRun
$r = Roda @('-Acao', 'Ssh', '-Comando', 'uptime', '-DryRun')
Afirma ($r.Saida.Contains('-p 2222')) 'Ssh -DryRun imprime -p 2222'
Afirma ($r.Saida.Contains('operador@127.0.0.1')) 'Ssh -DryRun imprime operador@127.0.0.1'
$r = Roda @('-Acao', 'Sincronizar', '-DryRun')
Afirma ($r.Saida.Contains('scp')) 'Sincronizar -DryRun imprime scp'
Afirma ($r.Saida.Contains('/opt/ampara/src/infra/vm')) 'Sincronizar -DryRun imprime /opt/ampara/src/infra/vm'

if ($falhas -gt 0) { Write-Host "FALHOU: $falhas assercao(oes)"; exit 1 }
Write-Host 'PASSOU: todas as assercoes'
exit 0
