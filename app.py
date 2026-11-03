"""
Servidor Web Local em Flask — São Paulo Housing Analytics (Desafio SYNAPTA 2026)
Serve o dashboard interativo (HTML5, CSS3, JavaScript, Leaflet.js e Chart.js)
e disponibiliza endpoints REST (/api/*) com os dados imobiliários processados.
"""

import json
import os
import socket
import sys

try:
    from flask import Flask, jsonify, request, send_from_directory
except ModuleNotFoundError:
    print("=" * 68)
    print("  [ERRO] A biblioteca 'Flask' não foi encontrada neste ambiente Python.")
    print("  Para instalar as dependências do projeto, execute no terminal:")
    print("    pip install -r requirements.txt")
    print("  Ou no Windows (Python Launcher):")
    print("    py -m pip install -r requirements.txt")
    print("=" * 68)
    sys.exit(1)

import processar_dados
import gerar_graficos

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(BASE_DIR, "web")
GRAFICOS_DIR = os.path.join(BASE_DIR, "graficos")
DATA_JSON_PATH = os.path.join(WEB_DIR, "data", "housing_data.json")
ZONES_JS_PATH = os.path.join(WEB_DIR, "data", "sp_zones.js")

app = Flask(__name__, static_folder=WEB_DIR, static_url_path="")
app.json.ensure_ascii = False


def garantir_dados_processados():
    """Garante que os arquivos JSON/JS e gráficos existam antes de servir requisições."""
    if not os.path.exists(DATA_JSON_PATH) or not os.path.exists(ZONES_JS_PATH):
        print("[Flask] Processando base de dados e malha geográfica de São Paulo...")
        processar_dados.carregar_e_processar()
    if not os.path.exists(os.path.join(GRAFICOS_DIR, "01_media_vs_mediana_tipo.svg")):
        gerar_graficos.main()


def carregar_json_analitico():
    """Carrega o payload analítico consolidado do disco."""
    garantir_dados_processados()
    with open(DATA_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


# ==========================================
# ROTAS DE INTERFACE WEB (FRONTEND)
# ==========================================

@app.route("/")
def index():
    """Rota principal que entrega a aplicação interativa."""
    garantir_dados_processados()
    return send_from_directory(WEB_DIR, "index.html")


@app.route("/graficos/<path:filename>")
def servir_graficos(filename):
    """Serve os gráficos estáticos em SVG gerados para documentação."""
    return send_from_directory(GRAFICOS_DIR, filename)


# ==========================================
# ROTAS DA API REST (BACKEND DE DADOS)
# ==========================================

@app.route("/api/status", methods=["GET"])
def api_status():
    """Retorna o status do servidor Flask e o resumo da base carregada."""
    dados = carregar_json_analitico()
    geral = dados.get("geral", {})
    return jsonify({
        "status": "online",
        "servidor": "Flask Local Server — Desafio SYNAPTA 2026",
        "python_version": sys.version.split()[0],
        "dataset": "Sao Paulo Housing Prices (Kaggle)",
        "total_anuncios": geral.get("total_anuncios", 0),
        "total_bairros": dados.get("total_bairros", 0),
        "bairros_georreferenciados": dados.get("bairros_com_coords", 0),
        "aluguel_medio": geral.get("aluguel_medio", 0),
        "aluguel_mediano": geral.get("aluguel_mediano", 0),
        "preco_m2_medio": geral.get("preco_m2_medio", 0)
    })


@app.route("/api/dados", methods=["GET"])
def api_dados():
    """Retorna o conjunto completo de indicadores, regiões, bairros e rankings."""
    dados = carregar_json_analitico()
    return jsonify(dados)


@app.route("/api/regioes", methods=["GET"])
def api_regioes():
    """Retorna os indicadores estatísticos agrupados pelas Macrozonas de São Paulo."""
    dados = carregar_json_analitico()
    return jsonify({
        "geral": dados.get("geral", {}),
        "por_regiao": dados.get("por_regiao", {})
    })


@app.route("/api/bairros", methods=["GET"])
def api_bairros():
    """
    Retorna a lista de bairros com suporte a filtros via query string:
      - ?regiao=Zona Oeste
      - ?min_anuncios=15
      - ?q=pinheiros
    """
    dados = carregar_json_analitico()
    bairros = dados.get("bairros", [])

    regiao = request.args.get("regiao", "").strip()
    min_anuncios = request.args.get("min_anuncios", type=int, default=1)
    termo = request.args.get("q", "").strip().lower()

    filtrados = []
    for b in bairros:
        if regiao and regiao.lower() != "all" and b.get("regiao", "").lower() != regiao.lower():
            continue
        if b.get("qtd_imoveis", 0) < min_anuncios:
            continue
        if termo and termo not in b.get("nome", "").lower() and termo not in b.get("regiao", "").lower():
            continue
        filtrados.append(b)

    return jsonify({
        "total": len(filtrados),
        "filtros": {
            "regiao": regiao or "todas",
            "min_anuncios": min_anuncios,
            "q": termo or None
        },
        "bairros": filtrados
    })


@app.route("/api/rankings", methods=["GET"])
def api_rankings():
    """Retorna os rankings de localidades com maiores e menores médias (n >= 15)."""
    dados = carregar_json_analitico()
    return jsonify(dados.get("rankings", {}))


@app.route("/api/anuncios", methods=["GET"])
def api_anuncios():
    """
    Retorna os anúncios individuais filtrados por zona (região), bairro, tipo ou busca:
      - ?regiao=Zona Leste
      - ?bairro=Jardim Anália Franco
      - ?tipo=Apartamento
      - ?q=Rua
    """
    dados = carregar_json_analitico()
    anuncios = dados.get("anuncios", [])

    regiao = request.args.get("regiao", "").strip()
    bairro = request.args.get("bairro", "").strip()
    tipo = request.args.get("tipo", "").strip()
    termo = request.args.get("q", "").strip().lower()

    filtrados = []
    for a in anuncios:
        if regiao and regiao.lower() != "all" and a.get("regiao", "").lower() != regiao.lower():
            continue
        if bairro and bairro.lower() != "all" and a.get("district", "").lower() != bairro.lower():
            continue
        if tipo and tipo.lower() != "all" and a.get("type", "").lower() != tipo.lower():
            continue
        if termo:
            texto = f"{a.get('address', '')} {a.get('district', '')} {a.get('regiao', '')} {a.get('type', '')}".lower()
            if termo not in texto:
                continue
        filtrados.append(a)

    return jsonify({
        "total": len(filtrados),
        "anuncios": filtrados
    })


@app.route("/api/reprocessar", methods=["POST"])
def api_reprocessar():
    """Executa novamente o pipeline ETL e regenera os arquivos JSON/JS e gráficos SVG."""
    try:
        payload = processar_dados.carregar_e_processar()
        gerar_graficos.main()
        return jsonify({
            "status": "reprocessado",
            "total_anuncios": payload["geral"]["total_anuncios"],
            "total_bairros": payload["total_bairros"],
            "bairros_com_coords": payload["bairros_com_coords"]
        })
    except FileNotFoundError as exc:
        return jsonify({
            "status": "erro",
            "mensagem": str(exc)
        }), 404


def encontrar_porta_disponivel(porta_preferida=5000):
    """Retorna a porta preferida se estiver livre, ou a próxima disponível."""
    for candidato in [porta_preferida, 5001, 8000, 8080, 5050]:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", candidato)) != 0:
                return candidato
    return porta_preferida


if __name__ == "__main__":
    garantir_dados_processados()
    porta_env = int(os.environ.get("PORT", 5000))
    port = encontrar_porta_disponivel(porta_env)
    print("=" * 68)
    print("  SÃO PAULO HOUSING ANALYTICS — DESAFIO SYNAPTA 2026 (FLASK SERVER)")
    print("=" * 68)
    if port != porta_env:
        print(f"  [Aviso] A porta {porta_env} já estava em uso. Utilizando a porta {port}.")
    print(f"  Dashboard Principal : http://127.0.0.1:{port}")
    print(f"  Status da API       : http://127.0.0.1:{port}/api/status")
    print(f"  Dados Consolidados  : http://127.0.0.1:{port}/api/dados")
    print(f"  Macrozonas de SP    : http://127.0.0.1:{port}/api/regioes")
    print(f"  Consulta de Bairros : http://127.0.0.1:{port}/api/bairros?min_anuncios=15")
    print(f"  Rankings (n >= 15)  : http://127.0.0.1:{port}/api/rankings")
    print("=" * 68)
    app.run(host="127.0.0.1", port=port, debug=False)
