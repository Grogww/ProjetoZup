<#
.SYNOPSIS
  Regenera o backup PÚBLICO sanitizado (db/init/zup_backup.backup) a partir de um
  backup OFICIAL com dados reais (db/init/history/*_zup_backup.backup).

.DESCRIPTION
  Sobe um container PostGIS temporário e isolado, restaura o backup oficial,
  roda db/sanitize.sql (anonimiza nome/email/CPF/senha e zera tokens/avatares)
  e faz um pg_dump por cima de db/init/zup_backup.backup — que é o ÚNICO backup
  que vai ao repositório público. O container é sempre removido ao final.

  Por padrão usa o backup oficial mais recente de db/init/history/ (maior prefixo
  numérico). Use -OfficialBackup para escolher outro.

  Pré-requisito: Docker em execução. Não depende do docker-compose nem mexe nos
  volumes/containers do projeto (usa um container próprio, "zup_sanitize").

.EXAMPLE
  ./db/regenerate-public-backup.ps1

.EXAMPLE
  ./db/regenerate-public-backup.ps1 -OfficialBackup db/init/history/9_zup_backup.backup
#>
[CmdletBinding()]
param(
  [string]$OfficialBackup,
  [string]$Image = 'postgis/postgis:17-3.5',
  [string]$ContainerName = 'zup_sanitize'
)

$ErrorActionPreference = 'Stop'

# --- Caminhos -----------------------------------------------------------------
$DbDir       = $PSScriptRoot                          # .../db
$HistoryDir  = Join-Path $DbDir 'init/history'
$PublicBackup = Join-Path $DbDir 'init/zup_backup.backup'

# Helper: roda o docker e estoura se o exit code for != 0 (stderr "normal" do
# docker, como progresso, não deve abortar — só o exit code importa).
# Recebe os argumentos como UM array ($DockerArgs) — não use ValueFromRemaining
# nem [Parameter], senão a função vira "avançada" e o PS tenta casar -e/-d/-v
# com parâmetros comuns (-ErrorAction/-ErrorVariable), gerando ambiguidade.
function Invoke-Docker {
  param([string[]]$DockerArgs)
  # Local: impede que o stderr "normal" do pg_restore/psql/pg_dump (NOTICE,
  # progresso) seja promovido a erro fatal no PS 5.1. Só o exit code decide.
  $ErrorActionPreference = 'Continue'
  & docker @DockerArgs
  if ($LASTEXITCODE -ne 0) {
    throw "docker $($DockerArgs -join ' ') falhou (exit $LASTEXITCODE)."
  }
}

# Helper: remove o container temporário se (e só se) ele existir. Checar antes
# com `docker ps -aq` evita o stderr de "No such container" que o PowerShell 5.1
# transforma em erro fatal sob ErrorActionPreference = 'Stop'.
function Remove-TempContainer {
  $ErrorActionPreference = 'Continue'
  $existing = & docker ps -aq -f "name=^$ContainerName$"
  if ($existing) {
    & docker rm -f $ContainerName | Out-Null
  }
}

# Helper: espera o Postgres ficar realmente pronto. Roda com 'Continue' local
# porque `docker logs` despeja os logs do Postgres no stderr (que o PS 5.1
# promoveria a erro fatal sob 'Stop'). Gateia no marcador de fim da init para
# não pegar o servidor temporário do "double start" do entrypoint.
function Wait-PostgresReady {
  $ErrorActionPreference = 'Continue'
  foreach ($i in 1..120) {
    $logs = & docker logs $ContainerName 2>&1 | Out-String
    if ($logs -match 'PostgreSQL init process complete') {
      & docker exec $ContainerName pg_isready -U zup -d zup *> $null
      if ($LASTEXITCODE -eq 0) { return $true }
    }
    Start-Sleep -Seconds 1
  }
  return $false
}

# --- 1. Escolhe o backup oficial ---------------------------------------------
if (-not $OfficialBackup) {
  $latest = Get-ChildItem -Path $HistoryDir -Filter '*_zup_backup.backup' -ErrorAction Stop |
    Where-Object { $_.Name -match '^(\d+)_' } |
    Sort-Object { [int]($_.Name -replace '^(\d+)_.*$', '$1') } |
    Select-Object -Last 1
  if (-not $latest) {
    throw "Nenhum backup oficial encontrado em $HistoryDir (esperado <n>_zup_backup.backup)."
  }
  $OfficialBackup = $latest.FullName
}
$OfficialBackup = (Resolve-Path $OfficialBackup).Path
$OfficialName   = Split-Path $OfficialBackup -Leaf

Write-Host "==> Backup oficial (origem): $OfficialName" -ForegroundColor Cyan
Write-Host "==> Backup publico (destino): db/init/zup_backup.backup" -ForegroundColor Cyan

# --- 2. Sobe container temporario isolado ------------------------------------
# Remove um eventual container orfao de execucao anterior.
Remove-TempContainer

try {
  Write-Host "==> Subindo container temporario ($ContainerName)..." -ForegroundColor Cyan
  Invoke-Docker @(
    'run', '-d', '--name', $ContainerName,
    '-e', 'POSTGRES_USER=zup', '-e', 'POSTGRES_PASSWORD=zup', '-e', 'POSTGRES_DB=zup',
    '-v', "${DbDir}:/db", $Image
  ) | Out-Null

  # --- 3. Espera o Postgres ficar pronto -------------------------------------
  # ATENÇÃO ao "double start" do entrypoint do Postgres: no 1º boot ele sobe um
  # servidor TEMPORÁRIO (só no socket Unix) para rodar a init, depois o DERRUBA
  # e sobe o servidor real. Se agirmos durante essa janela, a conexão morre
  # ("container is not running"). Wait-PostgresReady gateia no marcador de fim
  # da init nos logs antes de validar com pg_isready.
  Write-Host "==> Aguardando a inicializacao do Postgres concluir..." -ForegroundColor Cyan
  if (-not (Wait-PostgresReady)) { throw "Timeout: Postgres nao ficou pronto a tempo." }

  # --- 4. Extensao PostGIS ----------------------------------------------------
  Write-Host "==> Habilitando PostGIS..." -ForegroundColor Cyan
  Invoke-Docker @(
    'exec', $ContainerName, 'psql', '-U', 'zup', '-d', 'zup',
    '-v', 'ON_ERROR_STOP=1', '-f', '/db/_CreateExtensionPostGIS.sql'
  )

  # --- 5. Restaura o backup oficial (dados reais) -----------------------------
  Write-Host "==> Restaurando $OfficialName..." -ForegroundColor Cyan
  Invoke-Docker @(
    'exec', $ContainerName, 'pg_restore', '--username', 'zup', '--dbname', 'zup',
    '--no-owner', '--no-privileges', "/db/init/history/$OfficialName"
  )

  # --- 6. Sanitiza ------------------------------------------------------------
  Write-Host "==> Sanitizando usuarios (anonimiza CPF/email/nome/senha)..." -ForegroundColor Cyan
  Invoke-Docker @(
    'exec', $ContainerName, 'psql', '-U', 'zup', '-d', 'zup',
    '-v', 'ON_ERROR_STOP=1', '-f', '/db/sanitize.sql'
  )

  # --- 7. Dump por cima do backup publico ------------------------------------
  Write-Host "==> Gerando db/init/zup_backup.backup (sanitizado)..." -ForegroundColor Cyan
  Invoke-Docker @(
    'exec', $ContainerName, 'pg_dump', '-U', 'zup', '-d', 'zup',
    '-Fc', '-f', '/db/init/zup_backup.backup'
  )

  Write-Host ""
  Write-Host "OK! Backup publico sanitizado regenerado." -ForegroundColor Green
  Write-Host "Login de demonstracao: use um dos CPFs acima + senha 'Demo@1234'." -ForegroundColor Green
  Write-Host "Valide com: docker compose down -v; docker compose up --build" -ForegroundColor Green
}
finally {
  # --- 8. Sempre remove o container temporario -------------------------------
  Write-Host "==> Removendo container temporario..." -ForegroundColor Cyan
  Remove-TempContainer
}
