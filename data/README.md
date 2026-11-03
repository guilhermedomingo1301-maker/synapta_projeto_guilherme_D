# Orientação sobre a Base de Dados (Dataset Kaggle)

Em conformidade com o **Item 4** e o **Anexo I** do **Edital nº 1/2026 — SYNAPTA (UNINASSAU Maceió)**, esta pasta documenta a origem e as instruções de obtenção do dataset utilizado na análise.

## 1. Fonte Oficial dos Dados

- **Nome do Dataset**: *Sao Paulo Housing Prices* (Anúncios de Aluguel em São Paulo)
- **Plataforma**: Kaggle
- **Link para Download**: https://www.kaggle.com/datasets/renatosn/sao-paulo-housing-prices
- **Arquivo Principal**: `data.csv` (11.657 linhas e 8 colunas)

## 2. Como Posicionar o Dataset para Reprocessamento

1. Acesse a página do dataset no Kaggle pelo link acima e clique em **Download** (`archive.zip`).
2. Extraia o arquivo `data.csv` dentro da pasta `dados_extraidos/data.csv` (ou diretamente nesta pasta `data/data.csv`).
3. Execute o pipeline de processamento:
   ```bash
   python processar_dados.py
   ```
   *(No Windows com Python Launcher: `py processar_dados.py`)*

> **Nota**: Os indicadores agregados (`web/data/housing_data.json` e `web/data/housing_data.js`), a malha territorial simplificada das 5 Macrozonas de São Paulo (`web/data/sp_zones.js`) e os gráficos vetoriais (`graficos/*.svg`) já estão pré-compilados no repositório, permitindo que o servidor Flask (`python app.py`) funcione imediatamente após clonar o repositório.
