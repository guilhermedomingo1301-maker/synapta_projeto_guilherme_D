"""
Gerador de Gráficos Estáticos (SVG) para o Relatório no GitHub — Desafio SYNAPTA 2026
Lê os dados processados em web/data/housing_data.json e exporta gráficos vetoriais
legíveis, com títulos, eixos identificados e rótulos de dados na pasta graficos/.
"""

import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(BASE_DIR, "web", "data", "housing_data.json")
OUT_DIR = os.path.join(BASE_DIR, "graficos")

os.makedirs(OUT_DIR, exist_ok=True)


def fmt_brl(val):
    inteiro = int(round(val))
    return f"R$ {inteiro:,}".replace(",", ".")


def gerar_grafico_1_tipo(dados):
    """Gráfico 1: Aluguel Médio vs Mediano por Tipo de Imóvel."""
    por_tipo = dados["por_tipo"]
    width, height = 820, 440
    pad_left, pad_right, pad_top, pad_bottom = 90, 40, 85, 75
    plot_w = width - pad_left - pad_right
    plot_h = height - pad_top - pad_bottom
    max_y = 4500

    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="100%" height="100%">',
        '<rect width="100%" height="100%" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>',
        '<text x="410" y="34" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="17" font-weight="700" fill="#0f172a">Gráfico 1 — Preço Médio vs. Preço Mediano do Aluguel por Tipo de Imóvel</text>',
        '<text x="410" y="55" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12.5" fill="#64748b">Comparação da assimetria positiva entre a média aritmética e o valor central (mediana) em São Paulo (n = 11.657)</text>',
        # Legenda
        '<rect x="290" y="66" width="12" height="12" rx="3" fill="#2563eb"/>',
        '<text x="308" y="76" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#334155">Aluguel Médio (R$)</text>',
        '<rect x="440" y="66" width="12" height="12" rx="3" fill="#10b981"/>',
        '<text x="458" y="76" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#334155">Aluguel Mediano (R$)</text>',
    ]

    # Linhas de grade Y
    for step in range(0, max_y + 1, 900):
        y = pad_top + plot_h - (step / max_y) * plot_h
        svg.append(f'<line x1="{pad_left}" y1="{y:.1f}" x2="{width - pad_right}" y2="{y:.1f}" stroke="#e2e8f0" stroke-dasharray="4,4" stroke-width="1"/>')
        svg.append(f'<text x="{pad_left - 10}" y="{y + 4:.1f}" text-anchor="end" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="11.5" fill="#475569">{fmt_brl(step)}</text>')

    # Título do eixo Y
    svg.append(f'<text x="22" y="{pad_top + plot_h / 2:.1f}" text-anchor="middle" transform="rotate(-90 22 {pad_top + plot_h / 2:.1f})" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#334155">Valor Mensal do Aluguel (R$)</text>')

    # Barras agrupadas
    n_groups = len(por_tipo)
    group_w = plot_w / n_groups
    bar_w = 48

    for idx, item in enumerate(por_tipo):
        cx = pad_left + group_w * idx + group_w / 2
        val_mean = item["aluguel_medio"]
        val_med = item["aluguel_mediano"]

        h_mean = (val_mean / max_y) * plot_h
        h_med = (val_med / max_y) * plot_h

        x_mean = cx - bar_w - 4
        y_mean = pad_top + plot_h - h_mean
        x_med = cx + 4
        y_med = pad_top + plot_h - h_med

        svg.append(f'<rect x="{x_mean:.1f}" y="{y_mean:.1f}" width="{bar_w}" height="{h_mean:.1f}" rx="5" fill="#2563eb"/>')
        svg.append(f'<text x="{x_mean + bar_w / 2:.1f}" y="{y_mean - 7:.1f}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="11" font-weight="700" fill="#1d4ed8">{fmt_brl(val_mean)}</text>')

        svg.append(f'<rect x="{x_med:.1f}" y="{y_med:.1f}" width="{bar_w}" height="{h_med:.1f}" rx="5" fill="#10b981"/>')
        svg.append(f'<text x="{x_med + bar_w / 2:.1f}" y="{y_med - 7:.1f}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="11" font-weight="700" fill="#047857">{fmt_brl(val_med)}</text>')

        # Rótulo X
        svg.append(f'<text x="{cx:.1f}" y="{pad_top + plot_h + 22}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12.5" font-weight="600" fill="#1e293b">{item["tipo"]}</text>')
        svg.append(f'<text x="{cx:.1f}" y="{pad_top + plot_h + 38}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="11" fill="#64748b">(n = {item["qtd"]:,})</text>'.replace(",", "."))

    svg.append(f'<line x1="{pad_left}" y1="{pad_top + plot_h}" x2="{width - pad_right}" y2="{pad_top + plot_h}" stroke="#94a3b8" stroke-width="1.5"/>')
    svg.append(f'<text x="{pad_left + plot_w / 2:.1f}" y="{height - 14}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#334155">Tipologia do Imóvel (Eixo X)</text>')
    svg.append("</svg>")

    with open(os.path.join(OUT_DIR, "01_media_vs_mediana_tipo.svg"), "w", encoding="utf-8") as f:
        f.write("\n".join(svg))


def gerar_grafico_2_quartos(dados):
    """Gráfico 2: Progressão do Aluguel por Quantidade de Quartos."""
    por_quartos = dados["por_quartos"]
    width, height = 820, 440
    pad_left, pad_right, pad_top, pad_bottom = 90, 40, 85, 75
    plot_w = width - pad_left - pad_right
    plot_h = height - pad_top - pad_bottom
    max_y = 9000

    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="100%" height="100%">',
        '<rect width="100%" height="100%" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>',
        '<text x="410" y="34" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="17" font-weight="700" fill="#0f172a">Gráfico 2 — Progressão do Aluguel por Quantidade de Quartos</text>',
        '<text x="410" y="55" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12.5" fill="#64748b">Relação direta entre o número de dormitórios e o valor mensal anunciado (Média e Mediana)</text>',
        '<rect x="290" y="66" width="12" height="12" rx="3" fill="#f59e0b"/>',
        '<text x="308" y="76" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#334155">Aluguel Médio (R$)</text>',
        '<rect x="440" y="66" width="12" height="12" rx="3" fill="#2563eb"/>',
        '<text x="458" y="76" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#334155">Aluguel Mediano (R$)</text>',
    ]

    for step in range(0, max_y + 1, 1800):
        y = pad_top + plot_h - (step / max_y) * plot_h
        svg.append(f'<line x1="{pad_left}" y1="{y:.1f}" x2="{width - pad_right}" y2="{y:.1f}" stroke="#e2e8f0" stroke-dasharray="4,4" stroke-width="1"/>')
        svg.append(f'<text x="{pad_left - 10}" y="{y + 4:.1f}" text-anchor="end" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="11.5" fill="#475569">{fmt_brl(step)}</text>')

    svg.append(f'<text x="22" y="{pad_top + plot_h / 2:.1f}" text-anchor="middle" transform="rotate(-90 22 {pad_top + plot_h / 2:.1f})" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#334155">Valor Mensal do Aluguel (R$)</text>')

    n_groups = len(por_quartos)
    group_w = plot_w / n_groups
    bar_w = 42

    for idx, item in enumerate(por_quartos):
        cx = pad_left + group_w * idx + group_w / 2
        val_mean = item["aluguel_medio"]
        val_med = item["aluguel_mediano"]

        h_mean = (val_mean / max_y) * plot_h
        h_med = (val_med / max_y) * plot_h

        x_mean = cx - bar_w - 3
        y_mean = pad_top + plot_h - h_mean
        x_med = cx + 3
        y_med = pad_top + plot_h - h_med

        svg.append(f'<rect x="{x_mean:.1f}" y="{y_mean:.1f}" width="{bar_w}" height="{h_mean:.1f}" rx="5" fill="#f59e0b"/>')
        svg.append(f'<text x="{x_mean + bar_w / 2:.1f}" y="{y_mean - 7:.1f}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="10.5" font-weight="700" fill="#b45309">{fmt_brl(val_mean)}</text>')

        svg.append(f'<rect x="{x_med:.1f}" y="{y_med:.1f}" width="{bar_w}" height="{h_med:.1f}" rx="5" fill="#2563eb"/>')
        svg.append(f'<text x="{x_med + bar_w / 2:.1f}" y="{y_med - 7:.1f}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="10.5" font-weight="700" fill="#1d4ed8">{fmt_brl(val_med)}</text>')

        q_label = f'{item["quartos"]} quarto(s)' if item["quartos"] != "0" else "0 (Studio)"
        svg.append(f'<text x="{cx:.1f}" y="{pad_top + plot_h + 22}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#1e293b">{q_label}</text>')
        svg.append(f'<text x="{cx:.1f}" y="{pad_top + plot_h + 38}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="11" fill="#64748b">(n = {item["qtd"]:,})</text>'.replace(",", "."))

    svg.append(f'<line x1="{pad_left}" y1="{pad_top + plot_h}" x2="{width - pad_right}" y2="{pad_top + plot_h}" stroke="#94a3b8" stroke-width="1.5"/>')
    svg.append(f'<text x="{pad_left + plot_w / 2:.1f}" y="{height - 14}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#334155">Quantidade de Quartos (Eixo X)</text>')
    svg.append("</svg>")

    with open(os.path.join(OUT_DIR, "02_aluguel_por_quartos.svg"), "w", encoding="utf-8") as f:
        f.write("\n".join(svg))


def gerar_grafico_3_area_e_vagas(dados):
    """Gráfico 3: Comparação do Aluguel por Faixa de Área (m²) e Vagas de Garagem."""
    por_area = dados["por_faixa_area"]
    por_vagas = dados["por_vagas"]
    width, height = 860, 440
    pad_top, pad_bottom = 85, 75
    plot_h = height - pad_top - pad_bottom
    max_y = 9000

    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="100%" height="100%">',
        '<rect width="100%" height="100%" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>',
        '<text x="430" y="34" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="17" font-weight="700" fill="#0f172a">Gráfico 3 — Aluguel Médio segundo Faixa de Área Útil (m²) e Vagas de Garagem</text>',
        '<text x="430" y="55" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12.5" fill="#64748b">Comparação simultânea do impacto da metragem e do número de vagas sobre o aluguel mensal</text>',
    ]

    # Painel Esquerdo: Área Útil
    left_x0, left_w = 75, 345
    svg.append(f'<text x="{left_x0 + left_w / 2:.1f}" y="76" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="13" font-weight="700" fill="#1e293b">A) Por Faixa de Área Útil (m²)</text>')

    for step in range(0, max_y + 1, 1800):
        y = pad_top + plot_h - (step / max_y) * plot_h
        svg.append(f'<line x1="{left_x0}" y1="{y:.1f}" x2="{left_x0 + left_w}" y2="{y:.1f}" stroke="#e2e8f0" stroke-dasharray="4,4" stroke-width="1"/>')
        svg.append(f'<text x="{left_x0 - 8}" y="{y + 4:.1f}" text-anchor="end" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="10.5" fill="#475569">{fmt_brl(step)}</text>')

    gw_a = left_w / len(por_area)
    bw_a = 44
    for idx, item in enumerate(por_area):
        cx = left_x0 + gw_a * idx + gw_a / 2
        val = item["aluguel_medio"]
        h = (val / max_y) * plot_h
        y = pad_top + plot_h - h
        svg.append(f'<rect x="{cx - bw_a / 2:.1f}" y="{y:.1f}" width="{bw_a}" height="{h:.1f}" rx="5" fill="#8b5cf6"/>')
        svg.append(f'<text x="{cx:.1f}" y="{y - 6:.1f}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="10.5" font-weight="700" fill="#6d28d9">{fmt_brl(val)}</text>')
        svg.append(f'<text x="{cx:.1f}" y="{pad_top + plot_h + 20}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="10.5" font-weight="600" fill="#1e293b">{item["faixa"]}</text>')
        svg.append(f'<text x="{cx:.1f}" y="{pad_top + plot_h + 35}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="10" fill="#64748b">(n={item["qtd"]})</text>')

    svg.append(f'<line x1="{left_x0}" y1="{pad_top + plot_h}" x2="{left_x0 + left_w}" y2="{pad_top + plot_h}" stroke="#94a3b8" stroke-width="1.5"/>')
    svg.append(f'<text x="{left_x0 + left_w / 2:.1f}" y="{height - 14}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="11.5" font-weight="600" fill="#334155">Faixas de Metragem (m²)</text>')

    # Painel Direito: Vagas de Garagem
    right_x0, right_w = 485, 345
    svg.append(f'<text x="{right_x0 + right_w / 2:.1f}" y="76" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="13" font-weight="700" fill="#1e293b">B) Por Vagas de Garagem</text>')

    for step in range(0, max_y + 1, 1800):
        y = pad_top + plot_h - (step / max_y) * plot_h
        svg.append(f'<line x1="{right_x0}" y1="{y:.1f}" x2="{right_x0 + right_w}" y2="{y:.1f}" stroke="#e2e8f0" stroke-dasharray="4,4" stroke-width="1"/>')

    gw_g = right_w / len(por_vagas)
    bw_g = 38
    for idx, item in enumerate(por_vagas):
        cx = right_x0 + gw_g * idx + gw_g / 2
        val = item["aluguel_medio"]
        h = (val / max_y) * plot_h
        y = pad_top + plot_h - h
        svg.append(f'<rect x="{cx - bw_g / 2:.1f}" y="{y:.1f}" width="{bw_g}" height="{h:.1f}" rx="5" fill="#06b6d4"/>')
        svg.append(f'<text x="{cx:.1f}" y="{y - 6:.1f}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="10.5" font-weight="700" fill="#0e7490">{fmt_brl(val)}</text>')
        svg.append(f'<text x="{cx:.1f}" y="{pad_top + plot_h + 20}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="11" font-weight="600" fill="#1e293b">{item["vagas"]} vaga(s)</text>')
        svg.append(f'<text x="{cx:.1f}" y="{pad_top + plot_h + 35}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="10" fill="#64748b">(n={item["qtd"]})</text>')

    svg.append(f'<line x1="{right_x0}" y1="{pad_top + plot_h}" x2="{right_x0 + right_w}" y2="{pad_top + plot_h}" stroke="#94a3b8" stroke-width="1.5"/>')
    svg.append(f'<text x="{right_x0 + right_w / 2:.1f}" y="{height - 14}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="11.5" font-weight="600" fill="#334155">Quantidade de Vagas de Garagem</text>')
    svg.append("</svg>")

    with open(os.path.join(OUT_DIR, "03_aluguel_por_area_e_vagas.svg"), "w", encoding="utf-8") as f:
        f.write("\n".join(svg))


def gerar_grafico_4_rankings(dados):
    """Gráfico 4: Top 5 Localidades Mais Valorizadas vs Top 5 Mais Acessíveis (n >= 15)."""
    caros = dados["rankings"]["mais_caros"][:5]
    acessiveis = dados["rankings"]["mais_acessiveis"][:5]
    combinado = caros + acessiveis

    width, height = 840, 480
    pad_left, pad_right, pad_top, pad_bottom = 195, 95, 85, 50
    plot_w = width - pad_left - pad_right
    plot_h = height - pad_top - pad_bottom
    max_x = 12000

    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="100%" height="100%">',
        '<rect width="100%" height="100%" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>',
        '<text x="420" y="34" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="17" font-weight="700" fill="#0f172a">Gráfico 4 — Localidades com Maiores e Menores Aluguéis Médios (n ≥ 15 anúncios)</text>',
        '<text x="420" y="55" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12.5" fill="#64748b">Comparativo dos extremos de mercado utilizando apenas grupos com representatividade estatística</text>',
        '<rect x="255" y="66" width="12" height="12" rx="3" fill="#ef4444"/>',
        '<text x="273" y="76" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#334155">5 Maiores Médias (R$)</text>',
        '<rect x="435" y="66" width="12" height="12" rx="3" fill="#10b981"/>',
        '<text x="453" y="76" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#334155">5 Menores Médias (R$)</text>',
    ]

    for step in range(0, max_x + 1, 2000):
        x = pad_left + (step / max_x) * plot_w
        svg.append(f'<line x1="{x:.1f}" y1="{pad_top}" x2="{x:.1f}" y2="{pad_top + plot_h}" stroke="#e2e8f0" stroke-dasharray="4,4" stroke-width="1"/>')
        svg.append(f'<text x="{x:.1f}" y="{pad_top + plot_h + 18}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="11" fill="#475569">{fmt_brl(step)}</text>')

    row_h = plot_h / len(combinado)
    bar_h = 22

    for idx, item in enumerate(combinado):
        cy = pad_top + row_h * idx + row_h / 2
        val = item["aluguel_medio"]
        w = (val / max_x) * plot_w
        is_top = idx < 5
        color = "#ef4444" if is_top else "#10b981"
        text_color = "#b91c1c" if is_top else "#047857"

        svg.append(f'<text x="{pad_left - 10}" y="{cy + 4:.1f}" text-anchor="end" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#1e293b">{item["nome"]} (n={item["qtd_imoveis"]})</text>')
        svg.append(f'<rect x="{pad_left}" y="{cy - bar_h / 2:.1f}" width="{w:.1f}" height="{bar_h}" rx="4" fill="{color}"/>')
        svg.append(f'<text x="{pad_left + w + 8:.1f}" y="{cy + 4:.1f}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="11.5" font-weight="700" fill="{text_color}">{fmt_brl(val)}</text>')

    svg.append(f'<line x1="{pad_left}" y1="{pad_top}" x2="{pad_left}" y2="{pad_top + plot_h}" stroke="#94a3b8" stroke-width="1.5"/>')
    svg.append(f'<text x="{pad_left + plot_w / 2:.1f}" y="{height - 10}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#334155">Aluguel Mensal Médio (R$)</text>')
    svg.append("</svg>")

    with open(os.path.join(OUT_DIR, "04_ranking_bairros_sp.svg"), "w", encoding="utf-8") as f:
        f.write("\n".join(svg))


def gerar_grafico_5_macrozonas(dados):
    """Gráfico 5: Comparativo das 5 Macrozonas Oficiais da Cidade de São Paulo."""
    zonas = ["Zona Oeste", "Zona Sul", "Zona Leste", "Zona Norte", "Centro"]
    por_regiao = dados["por_regiao"]
    width, height = 820, 440
    pad_left, pad_right, pad_top, pad_bottom = 90, 40, 85, 75
    plot_w = width - pad_left - pad_right
    plot_h = height - pad_top - pad_bottom
    max_y = 6000

    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="100%" height="100%">',
        '<rect width="100%" height="100%" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>',
        '<text x="410" y="34" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="17" font-weight="700" fill="#0f172a">Gráfico 5 — Aluguel Médio vs. Mediano nas 5 Macrozonas de São Paulo</text>',
        '<text x="410" y="55" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12.5" fill="#64748b">Distribuição regional dos preços de locação segundo a divisão territorial das Subprefeituras</text>',
        '<rect x="290" y="66" width="12" height="12" rx="3" fill="#ec4899"/>',
        '<text x="308" y="76" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#334155">Aluguel Médio (R$)</text>',
        '<rect x="440" y="66" width="12" height="12" rx="3" fill="#3b82f6"/>',
        '<text x="458" y="76" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#334155">Aluguel Mediano (R$)</text>',
    ]

    for step in range(0, max_y + 1, 1200):
        y = pad_top + plot_h - (step / max_y) * plot_h
        svg.append(f'<line x1="{pad_left}" y1="{y:.1f}" x2="{width - pad_right}" y2="{y:.1f}" stroke="#e2e8f0" stroke-dasharray="4,4" stroke-width="1"/>')
        svg.append(f'<text x="{pad_left - 10}" y="{y + 4:.1f}" text-anchor="end" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="11.5" fill="#475569">{fmt_brl(step)}</text>')

    svg.append(f'<text x="22" y="{pad_top + plot_h / 2:.1f}" text-anchor="middle" transform="rotate(-90 22 {pad_top + plot_h / 2:.1f})" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#334155">Valor Mensal do Aluguel (R$)</text>')

    group_w = plot_w / len(zonas)
    bar_w = 42

    for idx, z in enumerate(zonas):
        st = por_regiao[z]
        cx = pad_left + group_w * idx + group_w / 2
        val_mean = st["aluguel_medio"]
        val_med = st["aluguel_mediano"]

        h_mean = (val_mean / max_y) * plot_h
        h_med = (val_med / max_y) * plot_h

        x_mean = cx - bar_w - 3
        y_mean = pad_top + plot_h - h_mean
        x_med = cx + 3
        y_med = pad_top + plot_h - h_med

        svg.append(f'<rect x="{x_mean:.1f}" y="{y_mean:.1f}" width="{bar_w}" height="{h_mean:.1f}" rx="5" fill="#ec4899"/>')
        svg.append(f'<text x="{x_mean + bar_w / 2:.1f}" y="{y_mean - 7:.1f}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="10.5" font-weight="700" fill="#be185d">{fmt_brl(val_mean)}</text>')

        svg.append(f'<rect x="{x_med:.1f}" y="{y_med:.1f}" width="{bar_w}" height="{h_med:.1f}" rx="5" fill="#3b82f6"/>')
        svg.append(f'<text x="{x_med + bar_w / 2:.1f}" y="{y_med - 7:.1f}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="10.5" font-weight="700" fill="#1d4ed8">{fmt_brl(val_med)}</text>')

        svg.append(f'<text x="{cx:.1f}" y="{pad_top + plot_h + 22}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#1e293b">{z}</text>')
        svg.append(f'<text x="{cx:.1f}" y="{pad_top + plot_h + 38}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="10.5" fill="#64748b">R$ {st["preco_m2_medio"]:.2f}/m² (n={st["total_anuncios"]})</text>'.replace(".", ","))

    svg.append(f'<line x1="{pad_left}" y1="{pad_top + plot_h}" x2="{width - pad_right}" y2="{pad_top + plot_h}" stroke="#94a3b8" stroke-width="1.5"/>')
    svg.append(f'<text x="{pad_left + plot_w / 2:.1f}" y="{height - 14}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#334155">Macrozonas do Município de São Paulo (Eixo X)</text>')
    svg.append("</svg>")

    with open(os.path.join(OUT_DIR, "05_comparativo_macrozonas_sp.svg"), "w", encoding="utf-8") as f:
        f.write("\n".join(svg))


def main():
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        dados = json.load(f)

    gerar_grafico_1_tipo(dados)
    gerar_grafico_2_quartos(dados)
    gerar_grafico_3_area_e_vagas(dados)
    gerar_grafico_4_rankings(dados)
    gerar_grafico_5_macrozonas(dados)
    print(f"5 gráficos SVG gerados com sucesso em: {OUT_DIR}")


if __name__ == "__main__":
    main()
