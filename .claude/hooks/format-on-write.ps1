$ErrorActionPreference = 'SilentlyContinue'

$json = ($input | Out-String) | ConvertFrom-Json
$f = $json.tool_input.file_path
if (-not $f) { $f = $json.tool_response.filePath }

if ($f -and (Test-Path -LiteralPath $f) -and ($f -match '\.(tsx|jsx|md|mdx)$')) {
    & npx --no-install prettier --write $f 2>$null
    & npx --no-install eslint --fix $f 2>$null
}

exit 0
