-- Atualizações de um banco que já existe, sem apagar os dados.
-- Pode rodar quantas vezes quiser: cada comando só muda o que ainda falta.
-- O "Iniciar BurguerSabor.bat" roda este arquivo sozinho a cada início.

-- Reembolso de pedido entregue (novembro/2026)
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS motivo_reembolso VARCHAR(300);
ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_status_pagamento_check;
ALTER TABLE pagamentos ADD CONSTRAINT pagamentos_status_pagamento_check
    CHECK (status_pagamento IN ('PENDENTE', 'APROVADO', 'RECUSADO', 'REEMBOLSO_SOLICITADO', 'REEMBOLSADO'));
