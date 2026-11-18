<#
.SYNOPSIS
  Lado Windows da VM do Ampara: imagem, disco, chave SSH, seed cloud-init, QEMU.
.DESCRIPTION
  Acoes: Preparar | Subir | Parar | Status | Sincronizar | Ssh
  Funciona no Windows PowerShell 5.1 e no pwsh. Arquivo so com ASCII de proposito:
  o PS 5.1 le script sem BOM como ANSI e estragaria acentos.
  Convencao: vm <Acao> = powershell -NoProfile -File infra/host/Criar-Vm.ps1 -Acao <Acao>
.EXAMPLE
  powershell -NoProfile -File infra/host/Criar-Vm.ps1 -Acao Subir -DryRun
#>
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Preparar', 'Subir', 'Parar', 'Status', 'Sincronizar', 'Ssh')]
    [string]$Acao,
    [string]$Comando = '',
    [string]$DiretorioVm = '',
    [string]$QemuDir = '',
    [ValidateSet('whpx', 'tcg')]
    [string]$Acel = 'whpx',
    [int]$Memoria = 4096,
    [int]$Cpus = 4,
    [int]$DiscoGB = 24,
    [int]$PortaHttp = 8080,
    [int]$PortaSsh = 2222,
    [int]$PortaSeed = 8088,
    [string]$RepoUrl = '',
    [switch]$SemProvisionar,
    [switch]$Recriar,
    [switch]$SomenteSeed,
    [switch]$DryRun,
    [switch]$ConfirmoDownload
)

$ErrorActionPreference = 'Stop'

$AquiDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path $MyInvocation.MyCommand.Path -Parent }
$InfraDir = Split-Path $AquiDir -Parent
if (-not $DiretorioVm) { $DiretorioVm = Join-Path $InfraDir '.vm' }
$RepoRaiz = Split-Path $InfraDir -Parent
$ImagemNome = 'noble-server-cloudimg-amd64.img'
$ImagemUrl = 'https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img'
$SumsUrl = 'https://cloud-images.ubuntu.com/noble/current/SHA256SUMS'

$Disco = Join-Path $DiretorioVm 'disco.qcow2'
$SeedDir = Join-Path $DiretorioVm 'seed'
$Chave = Join-Path $DiretorioVm 'id_ed25519'
$Console = Join-Path $DiretorioVm 'console.log'

function Falha {
    param([string]$Msg, [int]$Codigo = 1)
    # Write-Host (stdout) e nao Write-Error: a mensagem sai inteira, sem quebra de linha do formatador
    Write-Host $Msg
    exit $Codigo
}

function Escreve-Texto {
    # UTF-8 sem BOM e fim de linha LF (Set-Content -Encoding UTF8 do PS 5.1 grava BOM e quebra #cloud-config)
    param([string]$Caminho, [string]$Texto)
    $lf = $Texto.Replace("`r`n", "`n").Replace("`r", "`n")
    [IO.File]::WriteAllText($Caminho, $lf, (New-Object System.Text.UTF8Encoding($false)))
}

function Test-PortaLivre {
    param([int]$p)
    $l = $null
    try {
        $l = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Parse('127.0.0.1'), $p)
        $l.Start()
        return $true
    }
    catch { return $false }
    finally { if ($l) { $l.Stop() } }
}

function Find-QemuDir {
    $candidatos = @()
    if ($QemuDir) { $candidatos += $QemuDir }
    else {
        $cmd = Get-Command 'qemu-system-x86_64.exe' -ErrorAction SilentlyContinue
        if ($cmd) { $candidatos += (Split-Path $cmd.Source -Parent) }
        $candidatos += (Join-Path $HOME 'scoop\apps\qemu\current')
        $candidatos += (Join-Path $env:ProgramFiles 'qemu')
    }
    foreach ($c in $candidatos) {
        if ($c -and (Test-Path (Join-Path $c 'qemu-system-x86_64.exe'))) { return $c }
    }
    return $null
}

function Exige-Qemu {
    $d = Find-QemuDir
    if (-not $d) {
        Falha 'qemu-system-x86_64.exe nao encontrado. Instale (scoop install qemu) ou passe -QemuDir <pasta>.' 4
    }
    return $d
}

function Get-QemuArgs {
    [OutputType([string[]])]
    param()
    $accel = if ($Acel -eq 'tcg') { 'tcg' } else { 'whpx,kernel-irqchip=off' }
    $fwd = "hostfwd=tcp:127.0.0.1:$PortaHttp-:80,hostfwd=tcp:127.0.0.1:$PortaSsh-:22"
    return @(
        '-name', 'ampara-vm',
        '-machine', 'q35',
        '-accel', $accel,
        '-cpu', 'qemu64',
        '-smp', "$Cpus",
        '-m', "$Memoria",
        '-drive', "file=$Disco,if=virtio,format=qcow2",
        '-netdev', "user,id=n0,$fwd",
        '-device', 'virtio-net-pci,netdev=n0',
        '-smbios', "type=1,serial=ds=nocloud;s=http://10.0.2.2:$PortaSeed/",
        '-display', 'none',
        '-serial', "file:$Console"
    )
}

function Quote-Arg {
    param([string]$a)
    if ($a -match '[\s;"]') { return '"' + $a.Replace('"', '\"') + '"' }
    return $a
}

function Find-Python {
    foreach ($n in @('python.exe', 'py.exe')) {
        $c = Get-Command $n -ErrorAction SilentlyContinue
        if ($c) { return $c.Source }
    }
    return $null
}

function Get-ImagemBase {
    $img = Join-Path $DiretorioVm $ImagemNome
    $sums = Join-Path $DiretorioVm 'SHA256SUMS'
    $precisaImg = -not (Test-Path $img)
    $precisaSums = -not (Test-Path $sums)
    if ($precisaImg -or $precisaSums) {
        if (-not $ConfirmoDownload) {
            Falha ("Falta a imagem base do Ubuntu 24.04 (cerca de 600 MB), origem: $ImagemUrl . " +
                "Rode de novo com -ConfirmoDownload para baixar.") 3
        }
        if ($DryRun) { Write-Host "[DryRun] baixaria $ImagemUrl e $SumsUrl para $DiretorioVm"; return $img }
        $ProgressPreference = 'SilentlyContinue'
        if ($precisaImg) { Write-Host "Baixando $ImagemUrl ..."; Invoke-WebRequest -Uri $ImagemUrl -OutFile $img -UseBasicParsing }
        if ($precisaSums) { Invoke-WebRequest -Uri $SumsUrl -OutFile $sums -UseBasicParsing }
    }
    if ($DryRun) { Write-Host "[DryRun] conferiria o SHA256 de $img contra $sums"; return $img }
    $linha = Get-Content $sums | Where-Object { $_ -match [regex]::Escape($ImagemNome) } | Select-Object -First 1
    if (-not $linha) { Falha "SHA256SUMS nao lista $ImagemNome." 1 }
    $esperado = ($linha -split '\s+')[0].ToLowerInvariant()
    $obtido = (Get-FileHash -Algorithm SHA256 -Path $img).Hash.ToLowerInvariant()
    if ($esperado -ne $obtido) { Falha "SHA256 da imagem nao confere (esperado $esperado, obtido $obtido). Apague $img e baixe de novo." 1 }
    Write-Host "SHA256 da imagem confere."
    return $img
}

function New-ChaveSsh {
    if (Test-Path $Chave) { return }
    if ($DryRun) { Write-Host "[DryRun] ssh-keygen -t ed25519 -N '' -f $Chave"; return }
    # System.Diagnostics.Process: o PS 5.1 perde o argumento vazio de -N "" em comando nativo
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'ssh-keygen'
    $psi.Arguments = '-q -t ed25519 -N "" -C ampara-vm -f "' + $Chave + '"'
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $p = [System.Diagnostics.Process]::Start($psi)
    $p.WaitForExit()
    if ($p.ExitCode -ne 0 -or -not (Test-Path "$Chave.pub")) { Falha 'ssh-keygen falhou ao gerar a chave id_ed25519.' 1 }
}

function New-Seed {
    if ($DryRun) { Write-Host "[DryRun] montaria o seed em $SeedDir (user-data, meta-data, vendor-data, ampara.tar.gz de git archive HEAD)"; return }
    New-Item -ItemType Directory -Force -Path $SeedDir | Out-Null
    $pub = (Get-Content "$Chave.pub" -Raw).Trim()
    $modelo = [IO.File]::ReadAllText((Join-Path $InfraDir 'cloud-init\user-data'))
    $prov = if ($SemProvisionar) { 'false' } else { 'true' }
    $ud = $modelo.Replace('__SSH_PUBKEY__', $pub).Replace('__REPO_URL__', $RepoUrl).Replace('__PROVISIONAR__', $prov).Replace('__PORTA_SEED__', "$PortaSeed")
    if ($ud.Contains('__')) { Falha 'user-data ficou com marcador __ nao substituido.' 1 }
    Escreve-Texto (Join-Path $SeedDir 'user-data') $ud
    $meta = [IO.File]::ReadAllText((Join-Path $InfraDir 'cloud-init\meta-data'))
    Escreve-Texto (Join-Path $SeedDir 'meta-data') $meta
    Escreve-Texto (Join-Path $SeedDir 'vendor-data') ''

    $sujo = (& git -C $RepoRaiz status --porcelain 2>$null)
    if ($sujo) { Write-Host 'AVISO: Commit antes: o seed leva o HEAD (alteracoes nao commitadas ficam de fora).' }
    $tar = Join-Path $SeedDir 'ampara.tar.gz'
    & git -C $RepoRaiz archive --format=tar.gz -o $tar HEAD
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $tar) -or (Get-Item $tar).Length -eq 0) {
        Falha 'git archive HEAD falhou (o repositorio precisa ter ao menos um commit).' 1
    }
    Write-Host "Seed montado em $SeedDir"
}

function Start-SeedHttp {
    $py = Find-Python
    if (-not $py) { Falha 'python nao encontrado no PATH (necessario para servir o seed).' 4 }
    $args2 = '-m http.server ' + $PortaSeed + ' --bind 127.0.0.1 --directory ' + (Quote-Arg $SeedDir)
    $p = Start-Process -FilePath $py -ArgumentList $args2 -WindowStyle Hidden -PassThru
    Set-Content -Path (Join-Path $DiretorioVm 'seed.pid') -Value $p.Id -Encoding ASCII
    Write-Host "Servidor do seed no PID $($p.Id) (127.0.0.1:$PortaSeed)"
}

function Get-PidArquivo {
    param([string]$Nome)
    $f = Join-Path $DiretorioVm $Nome
    if (-not (Test-Path $f)) { return $null }
    $t = (Get-Content $f -Raw).Trim()
    if ($t -match '^\d+$') { return [int]$t }
    return $null
}

function Invoke-Ssh {
    param([string]$ComandoRemoto)
    $a = @('-i', $Chave, '-p', "$PortaSsh", '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL', '-o', 'LogLevel=ERROR', 'operador@127.0.0.1')
    if ($ComandoRemoto) { $a += $ComandoRemoto }
    if ($DryRun) { Write-Host ('[DryRun] ssh ' + ($a -join ' ')); return 0 }
    & ssh @a
    return $LASTEXITCODE
}

switch ($Acao) {
    'Preparar' {
        if ($DryRun) { Write-Host "[DryRun] Preparar em $DiretorioVm" }
        else { New-Item -ItemType Directory -Force -Path $DiretorioVm | Out-Null }
        if (-not $SomenteSeed) {
            $img = Get-ImagemBase
            if ($Recriar -and (Test-Path $Disco) -and -not $DryRun) { Remove-Item -Force $Disco }
            if (-not (Test-Path $Disco)) {
                $qd = if ($DryRun) { Find-QemuDir } else { Exige-Qemu }
                $qimg = if ($qd) { Join-Path $qd 'qemu-img.exe' } else { 'qemu-img' }
                $cmdImg = @('create', '-f', 'qcow2', '-b', $img, '-F', 'qcow2', $Disco, "$($DiscoGB)G")
                if ($DryRun) { Write-Host ('[DryRun] ' + $qimg + ' ' + ($cmdImg -join ' ')) }
                else {
                    & $qimg @cmdImg
                    if ($LASTEXITCODE -ne 0) { Falha 'qemu-img create falhou.' 1 }
                }
            }
            else { Write-Host "Disco ja existe ($Disco). Use -Recriar para refazer." }
        }
        New-ChaveSsh
        New-Seed
    }
    'Subir' {
        # a checagem de porta vem antes de procurar o QEMU (erro claro e rapido)
        foreach ($p in @($PortaHttp, $PortaSsh, $PortaSeed)) {
            if (-not (Test-PortaLivre $p)) {
                if ($DryRun) { Write-Host "AVISO: porta $p ocupada; o Subir real recusaria." }
                else { Falha "Porta $p em uso. Feche o programa que a usa ou passe -PortaHttp/-PortaSsh/-PortaSeed." 2 }
            }
        }
        $qemuArgs = Get-QemuArgs
        if ($DryRun) {
            $qd = Find-QemuDir
            $exe = if ($qd) { Join-Path $qd 'qemu-system-x86_64.exe' } else { 'qemu-system-x86_64.exe' }
            Write-Host ('[DryRun] python -m http.server ' + $PortaSeed + ' --bind 127.0.0.1 --directory ' + $SeedDir)
            Write-Host ('[DryRun] ' + $exe + ' ' + (($qemuArgs | ForEach-Object { Quote-Arg $_ }) -join ' '))
            break
        }
        $qd = Exige-Qemu
        if (-not (Test-Path $Disco)) { Falha "Disco nao encontrado ($Disco). Rode antes: -Acao Preparar" 1 }
        if (-not (Test-Path (Join-Path $SeedDir 'user-data'))) { Falha "Seed nao encontrado ($SeedDir). Rode antes: -Acao Preparar" 1 }
        Start-SeedHttp
        $exe = Join-Path $qd 'qemu-system-x86_64.exe'
        $lista = ($qemuArgs | ForEach-Object { Quote-Arg $_ }) -join ' '
        $q = Start-Process -FilePath $exe -ArgumentList $lista -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $DiretorioVm 'qemu.out.log') -RedirectStandardError (Join-Path $DiretorioVm 'qemu.err.log')
        Set-Content -Path (Join-Path $DiretorioVm 'qemu.pid') -Value $q.Id -Encoding ASCII
        Write-Host "QEMU no PID $($q.Id). Console em $Console. HTTP em http://127.0.0.1:$PortaHttp/ e SSH na porta $PortaSsh."
    }
    'Parar' {
        foreach ($par in @(@('qemu.pid', 'qemu'), @('seed.pid', 'python'))) {
            $id = Get-PidArquivo $par[0]
            if ($null -eq $id) { continue }
            if ($DryRun) { Write-Host "[DryRun] Stop-Process -Id $id"; continue }
            $proc = Get-Process -Id $id -ErrorAction SilentlyContinue
            # confere o nome para nao matar um PID reaproveitado por outro programa
            if ($proc -and $proc.ProcessName -like ($par[1] + '*')) {
                Stop-Process -Id $id -Force
                Write-Host "Encerrado PID $id ($($proc.ProcessName))."
            }
            else { Write-Host "PID $id ($($par[0])) ja nao esta rodando." }
            Remove-Item -Force (Join-Path $DiretorioVm $par[0]) -ErrorAction SilentlyContinue
        }
    }
    'Status' {
        foreach ($n in @('qemu.pid', 'seed.pid')) {
            $id = Get-PidArquivo $n
            $vivo = $null -ne $id -and ($null -ne (Get-Process -Id $id -ErrorAction SilentlyContinue))
            $estado = if ($vivo) { 'rodando' } else { 'parado' }
            Write-Host "$n : $estado $(if ($null -ne $id) { "(PID $id)" })"
        }
        foreach ($p in @($PortaHttp, $PortaSsh, $PortaSeed)) {
            $estado = if (Test-PortaLivre $p) { 'livre' } else { 'em uso' }
            Write-Host "porta $p : $estado"
        }
    }
    'Sincronizar' {
        $origem = Join-Path $InfraDir 'vm'
        $dest = '/opt/ampara/src/infra/vm'
        $sshOpts = @('-i', $Chave, '-P', "$PortaSsh", '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL', '-o', 'LogLevel=ERROR')
        $cmdScp = @('-r') + $sshOpts + @((Join-Path $origem '.'), 'operador@127.0.0.1:/tmp/vm-sync/')
        if ($DryRun) { Write-Host ('[DryRun] scp ' + ($cmdScp -join ' ')) }
        else {
            $rc = Invoke-Ssh 'rm -rf /tmp/vm-sync && mkdir -p /tmp/vm-sync'
            if ($rc -ne 0) { Falha 'Nao consegui falar com a VM por SSH (ela esta de pe?).' 1 }
            & scp @cmdScp
            if ($LASTEXITCODE -ne 0) { Falha 'scp falhou.' 1 }
        }
        $inst = "sudo mkdir -p $dest && sudo cp -a /tmp/vm-sync/. $dest/ && sudo find $dest -name '*.sh' -exec chmod 0755 {} +"
        $rc = Invoke-Ssh $inst
        exit $rc
    }
    'Ssh' {
        $rc = Invoke-Ssh $Comando
        exit $rc
    }
}
exit 0
