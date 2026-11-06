import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AvaliacaoDetalhada, LojaRepository, ResumoAvaliacoes } from './loja.repository';

export interface DadosLoja extends ResumoAvaliacoes {
  nome: string;
  taxaEntrega: number;
  tempoEntregaMin: number;
  tempoEntregaMax: number;
}

/** Informações que o site mostra no topo da loja, como no iFood. Taxa e tempo vêm do .env. */
@Injectable()
export class LojaService {
  constructor(
    private readonly config: ConfigService,
    private readonly repo: LojaRepository,
  ) {}

  async dados(): Promise<DadosLoja> {
    return {
      nome: 'Burguer & Sabor',
      taxaEntrega: Number(this.config.get<string>('TAXA_ENTREGA') ?? 5),
      tempoEntregaMin: Number(this.config.get<string>('TEMPO_ENTREGA_MIN') ?? 30),
      tempoEntregaMax: Number(this.config.get<string>('TEMPO_ENTREGA_MAX') ?? 45),
      ...(await this.repo.resumoAvaliacoes()),
    };
  }

  avaliacoes(): Promise<AvaliacaoDetalhada[]> {
    return this.repo.listarAvaliacoes();
  }
}
