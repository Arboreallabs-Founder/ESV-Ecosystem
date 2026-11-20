# Rebuilds the STAGING database ("Ecosystem Secondary") as a copy of production's schema plus any
# migrations newer than production. Never touches production; refuses its project ref.
#
#   powershell -File scripts/staging/rebuild.ps1 -Dump <prod-schema.sql> -After 20261120000000
#
# -Dump   schema-only dump of production's public schema (see docs/MCP.md → Staging for the
#         pg_dump command). The migrations folder alone can't rebuild the database: the pipelines and
#         forms tables, approved_emails and others were created outside it.
# -After  the newest migration production already has; every migration after it is applied on top.
#
# Needs .env.staging.local (STAGING_DB_POOLER_URL). Wipes staging's public schema and auth users.
# -Extensions  CREATE EXTENSION statements for production's extensions (scripts/staging/prod-extensions.cjs);
#              a dump of `public` leaves them out, but its indexes use them (pg_trgm lives in public).
param(
  [Parameter(Mandatory = $true)][string]$Dump,
  [Parameter(Mandatory = $true)][string]$After,
  [string]$Extensions
)
$root = Resolve-Path "$PSScriptRoot/../.."
$envText = Get-Content "$root/.env.staging.local" -Raw
$db = [regex]::Match($envText, 'STAGING_DB_POOLER_URL=(\S+)').Groups[1].Value
if (-not $db) { throw 'STAGING_DB_POOLER_URL missing from .env.staging.local' }
if ($db -match 'hsabrzwsetjeaqutjrjb') { throw 'Refusing: that is the PRODUCTION project.' }
if (-not (Test-Path $Dump)) { throw "Dump not found: $Dump" }

node "$PSScriptRoot/reset-public.cjs" $db
if ($LASTEXITCODE -ne 0) { throw 'reset failed' }

$newer = Get-ChildItem "$root/supabase/migrations/*.sql" | Where-Object { $_.Name.Substring(0, 14) -gt $After } | Sort-Object Name
"applying production schema, then $($newer.Count) newer migration(s): $(($newer | ForEach-Object Name) -join ', ')"
$files = @()
if ($Extensions) { $files += $Extensions }
$files += $Dump
$files += @($newer | ForEach-Object FullName)
node "$PSScriptRoot/apply-sql.cjs" $db @files
if ($LASTEXITCODE -ne 0) { throw 'apply failed' }
'staging rebuilt'
