# Troca o nome que aparece embaixo do ícone do app no celular para "Burguer & Sabor".
$manifesto = Join-Path $PSScriptRoot '..\android\app\src\main\AndroidManifest.xml'
if (Test-Path $manifesto) {
  $texto = [IO.File]::ReadAllText($manifesto)
  $texto = $texto -replace 'android:label="[^"]*"', 'android:label="Burguer &amp; Sabor"'
  [IO.File]::WriteAllText($manifesto, $texto, (New-Object System.Text.UTF8Encoding $false))
  Write-Host 'Nome do app ajustado para Burguer & Sabor.'
}
