# Mostra onde o PostgreSQL deste computador está atendendo (não mostra senhas)
$saida = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'resultado-diagnostico.txt'
& {
  '== Servicos do PostgreSQL =='
  Get-Service -Name '*postgres*' -ErrorAction SilentlyContinue | Format-Table -AutoSize Name, Status, StartType | Out-String
  '== Portas em que o PostgreSQL esta atendendo =='
  $ids = @(Get-Process -Name 'postgres' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  if ($ids.Count -gt 0) {
    Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ids -contains $_.OwningProcess } | Sort-Object LocalPort -Unique | Format-Table -AutoSize LocalAddress, LocalPort | Out-String
  } else { 'Nenhum processo postgres rodando.' }
  '== Caminho do servico =='
  Get-CimInstance Win32_Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*postgres*' } | Select-Object -ExpandProperty PathName
  '== Pastas do PostgreSQL =='
  Get-ChildItem 'C:\Program Files\PostgreSQL' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
} | Out-File -FilePath $saida -Encoding utf8
Write-Host "Pronto. Resultado salvo em $saida"
