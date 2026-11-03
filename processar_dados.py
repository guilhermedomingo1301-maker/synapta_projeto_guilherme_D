"""
Script de Processamento de Dados e Malha Geográfica - Desafio SYNAPTA (São Paulo Housing Prices)
Lê data.csv e distritos-sp-raw.geojson, classifica os bairros nas 5 Regiões de São Paulo
(Centro, Zona Norte, Zona Sul, Zona Leste, Zona Oeste), simplifica a malha territorial
e exporta housing_data.js, housing_data.json e sp_zones.js para a aplicação Web.
"""

import csv
import json
import math
import os
import statistics
import unicodedata
from collections import defaultdict, Counter

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def obter_caminho_csv():
    """Localiza o arquivo data.csv em qualquer uma das pastas padrão do projeto."""
    candidatos = [
        os.path.join(BASE_DIR, "dados_extraidos", "data.csv"),
        os.path.join(BASE_DIR, "data", "data.csv"),
        os.path.join(BASE_DIR, "data.csv"),
    ]
    for caminho in candidatos:
        if os.path.exists(caminho):
            return caminho
    return candidatos[0]


CSV_PATH = obter_caminho_csv()
RAW_GEOJSON_PATH = (
    os.path.join(BASE_DIR, "dados_extraidos", "distritos-sp-raw.geojson")
    if os.path.exists(os.path.join(BASE_DIR, "dados_extraidos", "distritos-sp-raw.geojson"))
    else os.path.join(BASE_DIR, "data", "distritos-sp-raw.geojson")
)
WEB_DATA_DIR = os.path.join(BASE_DIR, "web", "data")
OUT_JSON = os.path.join(WEB_DATA_DIR, "housing_data.json")
OUT_JS = os.path.join(WEB_DATA_DIR, "housing_data.js")
OUT_ZONES_JS = os.path.join(WEB_DATA_DIR, "sp_zones.js")

os.makedirs(WEB_DATA_DIR, exist_ok=True)

# Mapeamento oficial das 32 Subprefeituras de São Paulo para as 5 Macrozonas
SUBPREF_TO_ZONE = {
    "SE": "Centro",
    # Zona Norte
    "CASA VERDE-CACHOEIRINHA": "Zona Norte",
    "FREGUESIA-BRASILANDIA": "Zona Norte",
    "JACANA-TREMEMBE": "Zona Norte",
    "PERUS": "Zona Norte",
    "PIRITUBA-JARAGUA": "Zona Norte",
    "SANTANA-TUCURUVI": "Zona Norte",
    "VILA MARIA-VILA GUILHERME": "Zona Norte",
    # Zona Oeste
    "BUTANTA": "Zona Oeste",
    "LAPA": "Zona Oeste",
    "PINHEIROS": "Zona Oeste",
    # Zona Sul
    "CAMPO LIMPO": "Zona Sul",
    "CAPELA DO SOCORRO": "Zona Sul",
    "CIDADE ADEMAR": "Zona Sul",
    "IPIRANGA": "Zona Sul",
    "JABAQUARA": "Zona Sul",
    "M'BOI MIRIM": "Zona Sul",
    "PARELHEIROS": "Zona Sul",
    "SANTO AMARO": "Zona Sul",
    "VILA MARIANA": "Zona Sul",
    # Zona Leste
    "ARICANDUVA-FORMOSA-CARRAO": "Zona Leste",
    "CIDADE TIRADENTES": "Zona Leste",
    "ERMELINO MATARAZZO": "Zona Leste",
    "GUAIANASES": "Zona Leste",
    "ITAIM PAULISTA": "Zona Leste",
    "ITAQUERA": "Zona Leste",
    "MOOCA": "Zona Leste",
    "PENHA": "Zona Leste",
    "SAO MATEUS": "Zona Leste",
    "SAO MIGUEL": "Zona Leste",
    "SAPOPEMBA": "Zona Leste",
    "VILA PRUDENTE": "Zona Leste",
}

# Coordenadas curadas dos bairros e distritos de São Paulo (Lat, Lng)
DISTRICT_COORDS = {
    # Centro
    "Centro": [-23.5475, -46.6361],
    "Centro Histórico de São Paulo": [-23.5489, -46.6338],
    "Sé": [-23.5505, -46.6333],
    "República": [-23.5435, -46.6436],
    "Bela Vista": [-23.5606, -46.6493],
    "Consolação": [-23.5518, -46.6582],
    "Santa Cecília": [-23.5358, -46.6514],
    "Santa Cecilia": [-23.5358, -46.6514],
    "Santa Efigênia": [-23.5392, -46.6378],
    "Santa Ifigênia": [-23.5392, -46.6378],
    "Vila Buarque": [-23.5447, -46.6508],
    "Higienópolis": [-23.5442, -46.6569],
    "Campos Elíseos": [-23.5332, -46.6465],
    "Bom Retiro": [-23.5284, -46.6384],
    "Liberdade": [-23.5583, -46.6342],
    "Cambuci": [-23.5681, -46.6219],
    "Aclimação": [-23.5714, -46.6288],
    "Glicério": [-23.5547, -46.6289],
    "Brás": [-23.5422, -46.6175],
    "Pari": [-23.5298, -46.6178],
    "Luz": [-23.5345, -46.6352],
    "Canindé": [-23.5236, -46.6215],

    # Zona Oeste
    "Pinheiros": [-23.5617, -46.7028],
    "Sumarezinho": [-23.5508, -46.6914],
    "Jardim Paulista": [-23.5694, -46.6631],
    "Cerqueira César": [-23.5594, -46.6669],
    "Jardim América": [-23.5658, -46.6711],
    "Jardim Europa": [-23.5789, -46.6853],
    "Jardim Paulistano": [-23.5739, -46.6897],
    "Itaim Bibi": [-23.5839, -46.6789],
    "Vila Olímpia": [-23.5956, -46.6869],
    "Vila Nova Conceição": [-23.5892, -46.6706],
    "Vila Madalena": [-23.5542, -46.6917],
    "Alto de Pinheiros": [-23.5489, -46.7089],
    "Perdizes": [-23.5369, -46.6744],
    "Vila Pompéia": [-23.5315, -46.6845],
    "Pompeia": [-23.5315, -46.6845],
    "Sumaré": [-23.5469, -46.6781],
    "Pacaembu": [-23.5417, -46.6667],
    "Barra Funda": [-23.5247, -46.6644],
    "Água Branca": [-23.5186, -46.6853],
    "Lapa": [-23.5217, -46.7042],
    "Alto da Lapa": [-23.5289, -46.7111],
    "Vila Ipojuca": [-23.5335, -46.7025],
    "Vila Leopoldina": [-23.5297, -46.7289],
    "Vila Romana": [-23.5294, -46.6939],
    "Butantã": [-23.5719, -46.7081],
    "Jardim Bonfiglioli": [-23.5789, -46.7389],
    "Rio Pequeno": [-23.5764, -46.7389],
    "Jaguaré": [-23.5414, -46.7469],
    "Jaguara": [-23.5105, -46.7462],
    "Caxingui": [-23.5789, -46.7189],
    "Vila Sônia": [-23.5919, -46.7319],
    "Jardim Londrina": [-23.6005, -46.7358],
    "Morumbi": [-23.6067, -46.7214],
    "Jardim Leonor": [-23.5992, -46.7155],
    "Jardim Ampliação": [-23.6215, -46.7365],
    "Paraíso do Morumbi": [-23.6248, -46.7342],
    "Vila Suzana": [-23.6139, -46.7314],
    "Panamby": [-23.6267, -46.7289],
    "Real Parque": [-23.6139, -46.7039],
    "Vila Progredior": [-23.5894, -46.7189],
    "Raposo Tavares": [-23.5936, -46.7725],

    # Zona Sul
    "Vila Mariana": [-23.5896, -46.6347],
    "Paraíso": [-23.5732, -46.6472],
    "Vila Clementino": [-23.5981, -46.6467],
    "Chácara Klabin": [-23.5936, -46.6319],
    "Saúde": [-23.6156, -46.6397],
    "Vila da Saúde": [-23.6156, -46.6397],
    "Chácara Inglesa": [-23.6068, -46.6352],
    "Vila Monte Alegre": [-23.6238, -46.6382],
    "Praça da Árvore": [-23.6111, -46.6389],
    "Bosque da Saúde": [-23.6089, -46.6294],
    "Vila Gumercindo": [-23.6025, -46.6195],
    "Mirandópolis": [-23.6053, -46.6439],
    "Planalto Paulista": [-23.6142, -46.6556],
    "Indianópolis": [-23.6019, -46.6628],
    "Moema": [-23.6019, -46.6628],
    "Campo Belo": [-23.6272, -46.6711],
    "Vila Congonhas": [-23.6295, -46.6612],
    "Jardim Aeroporto": [-23.6318, -46.6565],
    "Vila Paulista": [-23.6355, -46.6695],
    "Brooklin": [-23.6189, -46.6872],
    "Brooklin Paulista": [-23.6189, -46.6872],
    "Cidade Monções": [-23.6089, -46.6917],
    "Granja Julieta": [-23.6339, -46.7011],
    "Chácara Santo Antônio": [-23.6319, -46.7067],
    "Chácara Santo Antônio (zona Sul)": [-23.6319, -46.7067],
    "Chácara Santo Antônio (Zona Sul)": [-23.6319, -46.7067],
    "Santo Amaro": [-23.6542, -46.7083],
    "Campo Grande": [-23.6625, -46.6865],
    "Vila Andrade": [-23.6308, -46.7328],
    "Jabaquara": [-23.6478, -46.6417],
    "Vila Guarani (z Sul)": [-23.6392, -46.6418],
    "Vila Guarani (zona Sul)": [-23.6392, -46.6418],
    "Jardim Oriental": [-23.6435, -46.6445],
    "Parque Jabaquara": [-23.6465, -46.6518],
    "Vila Parque Jabaquara": [-23.6485, -46.6528],
    "Vila Santa Catarina": [-23.6567, -46.6592],
    "Vila Mascote": [-23.6489, -46.6681],
    "Jardim Prudência": [-23.6552, -46.6695],
    "Cursino": [-23.6278, -46.6186],
    "Ipiranga": [-23.5919, -46.6083],
    "Vila Monumento": [-23.5815, -46.6135],
    "Vila Dom Pedro I": [-23.5992, -46.6052],
    "Sacomã": [-23.6067, -46.5989],
    "Campo Limpo": [-23.6481, -46.7583],
    "Capão Redondo": [-23.6694, -46.7758],
    "Jardim São Luís": [-23.6669, -46.7331],
    "Jardim Ângela": [-23.6985, -46.7715],
    "Socorro": [-23.6889, -46.7106],
    "Cidade Ademar": [-23.6689, -46.6578],
    "Pedreira": [-23.6936, -46.6542],
    "Cidade Dutra": [-23.7153, -46.6989],
    "Grajaú": [-23.7547, -46.6981],
    "Parelheiros": [-23.8286, -46.7281],

    # Zona Leste
    "Mooca": [-23.5614, -46.5986],
    "Parque da Mooca": [-23.5761, -46.5972],
    "Alto da Mooca": [-23.5639, -46.5889],
    "Quarta Parada": [-23.5502, -46.5882],
    "Belém": [-23.5381, -46.5947],
    "Belenzinho": [-23.5381, -46.5947],
    "Chácara Belenzinho": [-23.5635, -46.5445],
    "Tatuapé": [-23.5401, -46.5768],
    "Cidade Mãe do Céu": [-23.5378, -46.5812],
    "Vila Gomes Cardim": [-23.5447, -46.5689],
    "Vila Bertioga": [-23.5567, -46.5861],
    "Vila Regente Feijó": [-23.5589, -46.5689],
    "Vila Invernada": [-23.5665, -46.5612],
    "Água Rasa": [-23.5558, -46.5744],
    "Vila Prudente": [-23.5828, -46.5819],
    "Vila Alpina": [-23.5915, -46.5655],
    "Vila Ema": [-23.5885, -46.5465],
    "Vila Formosa": [-23.5678, -46.5494],
    "Jardim Vila Formosa": [-23.5725, -46.5442],
    "Anália Franco": [-23.5578, -46.5619],
    "Jardim Anália Franco": [-23.5578, -46.5619],
    "Aricanduva": [-23.5725, -46.5125],
    "Vila Aricanduva": [-23.5385, -46.5355],
    "Vila Matilde": [-23.5342, -46.5292],
    "Vila Esperança": [-23.5275, -46.5245],
    "Vila Guilhermina": [-23.5325, -46.5155],
    "Vila Carrão": [-23.5519, -46.5389],
    "Carrão": [-23.5519, -46.5389],
    "Penha": [-23.5242, -46.5447],
    "Penha de França": [-23.5242, -46.5447],
    "Cangaíba": [-23.5083, -46.5289],
    "Ermelino Matarazzo": [-23.4947, -46.5028],
    "Ponte Rasa": [-23.5089, -46.4842],
    "Artur Alvim": [-23.5411, -46.4853],
    "Itaquera": [-23.5381, -46.4558],
    "Parque do Carmo": [-23.5769, -46.4678],
    "Cidade Líder": [-23.5639, -46.4869],
    "José Bonifácio": [-23.5514, -46.4389],
    "São Mateus": [-23.6083, -46.4789],
    "Sapopemba": [-23.6156, -46.5089],
    "São Lucas": [-23.5947, -46.5494],
    "São Miguel Paulista": [-23.4981, -46.4447],
    "Vila Jacuí": [-23.4989, -46.4689],
    "Vila Curuçá": [-23.5058, -46.4239],
    "Itaim Paulista": [-23.4989, -46.3942],
    "Jardim Helena": [-23.4739, -46.4278],
    "Guaianases": [-23.5489, -46.4178],
    "Lajeado": [-23.5358, -46.4139],
    "Cidade Tiradentes": [-23.5917, -46.3986],
    "Iguatemi": [-23.6019, -46.4258],
    "São Rafael": [-23.6294, -46.4639],

    # Zona Norte
    "Santana": [-23.5042, -46.6294],
    "Santa Teresinha": [-23.4935, -46.6345],
    "Vila Guilherme": [-23.5122, -46.6053],
    "Vila Isolina Mazzei": [-23.4965, -46.6065],
    "Vila Maria": [-23.5189, -46.5894],
    "Vila Maria Alta": [-23.5085, -46.5865],
    "Vila Medeiros": [-23.4895, -46.5845],
    "Casa Verde": [-23.5117, -46.6547],
    "Casa Verde Alta": [-23.4939, -46.6578],
    "Limão": [-23.5097, -46.6756],
    "Vila Palmeiras": [-23.5065, -46.6855],
    "Freguesia do Ó": [-23.4989, -46.6961],
    "Pirituba": [-23.4839, -46.7247],
    "Parque São Domingos": [-23.4989, -46.7389],
    "São Domingos": [-23.4989, -46.7389],
    "Jaraguá": [-23.4542, -46.7417],
    "Perus": [-23.4078, -46.7539],
    "Anhanguera": [-23.4219, -46.7869],
    "Mandaqui": [-23.4764, -46.6417],
    "Lauzane Paulista": [-23.4755, -46.6495],
    "Tucuruvi": [-23.4797, -46.6056],
    "Vila Mazzei": [-23.4715, -46.6015],
    "Vila Constança": [-23.4655, -46.5945],
    "Jaçanã": [-23.4656, -46.5861],
    "Tremembé": [-23.4561, -46.6281],
    "Brasilândia": [-23.4681, -46.6917],
    "Cachoeirinha": [-23.4689, -46.6669],
    "Água Fria": [-23.4897, -46.6219],
    "Jardim São Paulo": [-23.4917, -46.6258],
    "Parada Inglesa": [-23.4869, -46.6111],
    "Imirim": [-23.4947, -46.6519],
    "Chora Menino": [-23.4989, -46.6389],
}


def norm_str(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return s.upper().strip()


def simplify_ring(ring, step_tol=0.00055):
    """Simplifica anel de coordenadas preservando início/fim e reduzindo peso do GeoJSON."""
    if len(ring) <= 6:
        return [[round(pt[0], 4), round(pt[1], 4)] for pt in ring]

    out = [[round(ring[0][0], 4), round(ring[0][1], 4)]]
    last_x, last_y = ring[0][0], ring[0][1]

    for pt in ring[1:-1]:
        dx = pt[0] - last_x
        dy = pt[1] - last_y
        if (dx * dx + dy * dy) >= (step_tol * step_tol):
            out.append([round(pt[0], 4), round(pt[1], 4)])
            last_x, last_y = pt[0], pt[1]

    first = out[0]
    if out[-1] != first:
        out.append([first[0], first[1]])

    if len(out) < 4:
        return [[round(pt[0], 4), round(pt[1], 4)] for pt in ring[:4]]
    return out


def point_in_ring(lng, lat, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        intersect = ((yi > lat) != (yj > lat)) and (
            lng < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi
        )
        if intersect:
            inside = not inside
        j = i
    return inside


def point_in_geom(lng, lat, geom):
    gtype = geom["type"]
    coords = geom["coordinates"]
    if gtype == "Polygon":
        return point_in_ring(lng, lat, coords[0])
    elif gtype == "MultiPolygon":
        for poly in coords:
            if point_in_ring(lng, lat, poly[0]):
                return True
    return False


def compute_geom_centroid(geom):
    pts = []
    if geom["type"] == "Polygon":
        pts = geom["coordinates"][0]
    elif geom["type"] == "MultiPolygon":
        # Usa o maior polígono
        largest = max(geom["coordinates"], key=lambda p: len(p[0]))
        pts = largest[0]
    if not pts:
        return None
    avg_lng = sum(p[0] for p in pts) / len(pts)
    avg_lat = sum(p[1] for p in pts) / len(pts)
    return [round(avg_lat, 4), round(avg_lng, 4)]


def processar_malha_zonas():
    simplified_features = []
    district_norm_info = {}
    spatial_index = []

    if os.path.exists(RAW_GEOJSON_PATH):
        with open(RAW_GEOJSON_PATH, "r", encoding="utf-8") as f:
            raw_gj = json.load(f)

        # Nota geográfica oficial: Mooca/Brás/Pari/Belém/Tatuapé/Água Rasa pertencem à Zona Leste,
        # mas Brás e Pari às vezes são listados no Centro Expandido; seguimos a divisão oficial das Subprefeituras!
        for feat in raw_gj.get("features", []):
            props = feat.get("properties", {})
            subpref = props.get("ds_subpref", "").strip()
            ds_nome = props.get("ds_nome", "").strip()
            regiao = SUBPREF_TO_ZONE.get(subpref, "Outras")

            geom = feat["geometry"]
            centroid = compute_geom_centroid(geom)

            # Simplificar geometria
            if geom["type"] == "Polygon":
                new_coords = [simplify_ring(ring) for ring in geom["coordinates"]]
            else:
                new_coords = [[simplify_ring(ring) for ring in poly] for poly in geom["coordinates"]]

            simp_geom = {"type": geom["type"], "coordinates": new_coords}

            simplified_features.append({
                "type": "Feature",
                "properties": {
                    "distrito": ds_nome.title(),
                    "subprefeitura": subpref.title(),
                    "regiao": regiao,
                    "centroid": centroid
                },
                "geometry": simp_geom
            })

            district_norm_info[norm_str(ds_nome)] = {
                "regiao": regiao,
                "coords": centroid
            }
            spatial_index.append((regiao, simp_geom))

        out_gj = {"type": "FeatureCollection", "features": simplified_features}
        with open(OUT_ZONES_JS, "w", encoding="utf-8") as f:
            f.write("/* Malha Territorial Simplificada dos Distritos e Regiões de São Paulo */\n")
            f.write("window.SP_ZONES_GEOJSON = ")
            json.dump(out_gj, f, ensure_ascii=False, separators=(",", ":"))
            f.write(";\n")

        return out_gj, district_norm_info, spatial_index

    # Fallback: se o arquivo bruto distritos-sp-raw.geojson não estiver presente (ex.: clone do GitHub),
    # lê a malha já simplificada versionada em web/data/sp_zones.js
    if os.path.exists(OUT_ZONES_JS):
        with open(OUT_ZONES_JS, "r", encoding="utf-8") as f:
            conteudo = f.read()
        marcador = "window.SP_ZONES_GEOJSON ="
        idx = conteudo.find(marcador)
        if idx != -1:
            json_str = conteudo[idx + len(marcador):].strip().rstrip(";").strip()
            out_gj = json.loads(json_str)
            for feat in out_gj.get("features", []):
                props = feat.get("properties", {})
                ds_nome = props.get("distrito", "").strip()
                regiao = props.get("regiao", "Outras")
                simp_geom = feat.get("geometry", {})
                centroid = props.get("centroid") or compute_geom_centroid(simp_geom)
                district_norm_info[norm_str(ds_nome)] = {
                    "regiao": regiao,
                    "coords": centroid
                }
                spatial_index.append((regiao, simp_geom))
            return out_gj, district_norm_info, spatial_index

    return None, {}, []


def inferir_regiao_e_coords(nome_bairro, district_norm_info, spatial_index):
    # 1. Coordenada curada ou centróide do distrito oficial
    coords = DISTRICT_COORDS.get(nome_bairro)
    n_bairro = norm_str(nome_bairro)

    if not coords and n_bairro in district_norm_info:
        coords = district_norm_info[n_bairro]["coords"]

    # 2. Se possui coordenadas, verifica em qual polígono oficial de São Paulo cai
    if coords and spatial_index:
        lat, lng = coords[0], coords[1]
        for regiao_poly, geom in spatial_index:
            if point_in_geom(lng, lat, geom):
                return regiao_poly, coords

    # 3. Dicas explícitas no próprio nome do bairro no dataset
    low = nome_bairro.lower()
    if "zona sul" in low or "(z sul)" in low or "(sacom" in low:
        return "Zona Sul", coords
    if "zona leste" in low or "(z leste)" in low:
        return "Zona Leste", coords
    if "zona norte" in low or "(z norte)" in low:
        return "Zona Norte", coords
    if "zona oeste" in low or "(z oeste)" in low:
        return "Zona Oeste", coords
    if "centro" in low:
        return "Centro", coords

    # 4. Match normalizado com distritos oficiais
    if n_bairro in district_norm_info:
        return district_norm_info[n_bairro]["regiao"], coords

    # 5. Cidades da Região Metropolitana presentes no dataset (ex: Barueri/Alphaville, ABC, Taboão)
    metro_keywords = ["ALPHAVILLE", "TAMBORE", "RUDGE RAMOS", "TABOAO", "OSASCO", "SANTO ANDRE", "SAO CAETANO", "GUARULHOS", "COTIA", "GRANJA VIANA"]
    for kw in metro_keywords:
        if kw in n_bairro:
            return "Região Metropolitana", coords

    return "Não Classificado", coords


def calcular_bloco_estatistico(itens):
    rents = [x["rent"] for x in itens]
    totals = [x["total"] for x in itens]
    areas = [x["area"] for x in itens if x["area"] > 0]
    m2_vals = [x["rent_m2"] for x in itens if x["rent_m2"] > 0]

    # Por tipo
    tipos_dict = defaultdict(list)
    for r in itens:
        tipos_dict[r["type"]].append(r)

    por_tipo = []
    for t_name in ["Apartamento", "Casa", "Studio e kitnet", "Casa em condomínio"]:
        t_itens = tipos_dict.get(t_name, [])
        if t_itens:
            t_rents = [x["rent"] for x in t_itens]
            por_tipo.append({
                "tipo": t_name,
                "qtd": len(t_itens),
                "aluguel_medio": round(statistics.mean(t_rents), 2),
                "aluguel_mediano": round(statistics.median(t_rents), 2)
            })

    # Por quartos
    quartos_dict = defaultdict(list)
    for r in itens:
        q_label = str(r["bedrooms"]) if r["bedrooms"] < 4 else "4+"
        quartos_dict[q_label].append(r)

    por_quartos = []
    for q in ["0", "1", "2", "3", "4+"]:
        if q in quartos_dict:
            q_rents = [x["rent"] for x in quartos_dict[q]]
            por_quartos.append({
                "quartos": q,
                "qtd": len(quartos_dict[q]),
                "aluguel_medio": round(statistics.mean(q_rents), 2),
                "aluguel_mediano": round(statistics.median(q_rents), 2)
            })

    # Por vagas de garagem
    vagas_dict = defaultdict(list)
    for r in itens:
        g_label = str(r["garage"]) if r["garage"] < 4 else "4+"
        vagas_dict[g_label].append(r)

    por_vagas = []
    for g in ["0", "1", "2", "3", "4+"]:
        if g in vagas_dict:
            g_rents = [x["rent"] for x in vagas_dict[g]]
            por_vagas.append({
                "vagas": g,
                "qtd": len(vagas_dict[g]),
                "aluguel_medio": round(statistics.mean(g_rents), 2),
                "aluguel_mediano": round(statistics.median(g_rents), 2)
            })

    # Por faixa de área útil
    faixas_ordem = ["Até 50 m²", "51 a 100 m²", "101 a 200 m²", "Acima de 200 m²"]
    area_dict = defaultdict(list)
    for r in itens:
        a = r["area"]
        if a <= 0:
            continue
        elif a <= 50:
            faixa = "Até 50 m²"
        elif a <= 100:
            faixa = "51 a 100 m²"
        elif a <= 200:
            faixa = "101 a 200 m²"
        else:
            faixa = "Acima de 200 m²"
        area_dict[faixa].append(r)

    por_faixa_area = []
    for f_label in faixas_ordem:
        if f_label in area_dict:
            f_rents = [x["rent"] for x in area_dict[f_label]]
            por_faixa_area.append({
                "faixa": f_label,
                "qtd": len(area_dict[f_label]),
                "aluguel_medio": round(statistics.mean(f_rents), 2),
                "aluguel_mediano": round(statistics.median(f_rents), 2)
            })

    return {
        "total_anuncios": len(itens),
        "aluguel_medio": round(statistics.mean(rents), 2) if rents else 0,
        "aluguel_mediano": round(statistics.median(rents), 2) if rents else 0,
        "aluguel_min": min(rents) if rents else 0,
        "aluguel_max": max(rents) if rents else 0,
        "custo_total_medio": round(statistics.mean(totals), 2) if totals else 0,
        "custo_total_mediano": round(statistics.median(totals), 2) if totals else 0,
        "area_media": round(statistics.mean(areas), 1) if areas else 0,
        "preco_m2_medio": round(statistics.mean(m2_vals), 2) if m2_vals else 0,
        "por_tipo": por_tipo,
        "por_quartos": por_quartos,
        "por_vagas": por_vagas,
        "por_faixa_area": por_faixa_area
    }


def carregar_e_processar():
    csv_path = obter_caminho_csv()
    if not os.path.exists(csv_path):
        raise FileNotFoundError(
            f"Arquivo CSV não encontrado ({csv_path}). "
            "Posicione o arquivo 'data.csv' em 'dados_extraidos/data.csv' ou 'data/data.csv'."
        )

    _, district_norm_info, spatial_index = processar_malha_zonas()

    total_bruto = 0
    inconsistencias = {
        "area_zero_ou_negativa": 0,
        "duplicatas_exatas": 0,
        "duplicatas_parciais": 0,
        "total_menor_aluguel": 0,
        "campos_nulos": 0
    }

    registros_validos = []
    seen_exatos = set()
    seen_parciais = Counter()
    cache_regiao_bairro = {}

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_bruto += 1
            tup_exato = (
                row["address"], row["district"], row["area"], row["bedrooms"],
                row["garage"], row["type"], row["rent"], row["total"]
            )
            if tup_exato in seen_exatos:
                inconsistencias["duplicatas_exatas"] += 1
            seen_exatos.add(tup_exato)

            tup_parcial = (row["address"], row["district"], row["area"], row["bedrooms"], row["rent"])
            seen_parciais[tup_parcial] += 1

            try:
                area = float(row["area"])
                rent = float(row["rent"])
                total = float(row["total"])
                bedrooms = int(row["bedrooms"])
                garage = int(row["garage"])
                district = row["district"].strip()
                property_type = row["type"].strip()
                address = row["address"].strip()

                if area <= 0:
                    inconsistencias["area_zero_ou_negativa"] += 1
                if total < rent:
                    inconsistencias["total_menor_aluguel"] += 1

                if district not in cache_regiao_bairro:
                    cache_regiao_bairro[district] = inferir_regiao_e_coords(
                        district, district_norm_info, spatial_index
                    )
                regiao, coords = cache_regiao_bairro[district]

                registros_validos.append({
                    "address": address,
                    "district": district,
                    "regiao": regiao,
                    "coords": coords,
                    "area": area,
                    "bedrooms": bedrooms,
                    "garage": garage,
                    "type": property_type,
                    "rent": rent,
                    "total": total,
                    "rent_m2": round(rent / area, 2) if area > 0 else 0
                })
            except Exception:
                inconsistencias["campos_nulos"] += 1

    inconsistencias["duplicatas_parciais"] = sum(v - 1 for v in seen_parciais.values() if v > 1)

    # 1. Estatísticas Globais
    stats_global = calcular_bloco_estatistico(registros_validos)
    stats_global["total_bruto"] = total_bruto
    stats_global["inconsistencias"] = inconsistencias

    # 2. Agregações por Bairro e Coordenadas Individuais dos Anúncios (Espiral Áurea no Raio da Zona)
    bairros_dict = defaultdict(list)
    for r in registros_validos:
        bairros_dict[r["district"]].append(r)

    bairros_lista = []
    anuncios_export = []
    anuncio_id = 1
    golden_angle = 2.399963229728653  # ~137.508 graus em radianos

    for nome, itens in bairros_dict.items():
        b_rents = [x["rent"] for x in itens]
        b_totals = [x["total"] for x in itens]
        b_areas = [x["area"] for x in itens if x["area"] > 0]
        b_m2 = [x["rent_m2"] for x in itens if x["rent_m2"] > 0]

        regiao, coords = cache_regiao_bairro[nome]
        n_itens = len(itens)
        radius_m = max(300.0, min(1700.0, math.sqrt(n_itens) * 115.0))

        for idx_item, item in enumerate(itens):
            pin_coords = None
            if coords is not None:
                if n_itens == 1:
                    pin_coords = [coords[0], coords[1]]
                else:
                    r_m = radius_m * 0.72 * math.sqrt((idx_item + 0.5) / n_itens)
                    theta = idx_item * golden_angle
                    dlat = (r_m * math.sin(theta)) / 111132.0
                    dlng = (r_m * math.cos(theta)) / 101850.0
                    pin_coords = [round(coords[0] + dlat, 5), round(coords[1] + dlng, 5)]

            anuncios_export.append({
                "id": anuncio_id,
                "address": item["address"],
                "district": item["district"],
                "regiao": item["regiao"],
                "type": item["type"],
                "area": item["area"],
                "bedrooms": item["bedrooms"],
                "garage": item["garage"],
                "rent": item["rent"],
                "total": item["total"],
                "rent_m2": item["rent_m2"],
                "coords": pin_coords
            })
            anuncio_id += 1

        bairros_lista.append({
            "nome": nome,
            "regiao": regiao,
            "qtd_imoveis": n_itens,
            "aluguel_medio": round(statistics.mean(b_rents), 2),
            "aluguel_mediano": round(statistics.median(b_rents), 2),
            "aluguel_min": min(b_rents),
            "aluguel_max": max(b_rents),
            "custo_total_medio": round(statistics.mean(b_totals), 2),
            "area_media": round(statistics.mean(b_areas), 1) if b_areas else 0,
            "preco_m2_medio": round(statistics.mean(b_m2), 2) if b_m2 else 0,
            "coords": coords,
            "has_coords": coords is not None,
            "tipos": dict(Counter(x["type"] for x in itens)),
            "quartos": dict(Counter(x["bedrooms"] for x in itens))
        })

    bairros_lista.sort(key=lambda x: x["qtd_imoveis"], reverse=True)

    # 3. Agregações pelas 5 Regiões Oficiais de São Paulo (+ Região Metropolitana / Outras)
    regioes_dict = defaultdict(list)
    for r in registros_validos:
        regioes_dict[r["regiao"]].append(r)

    ordem_regioes = ["Centro", "Zona Sul", "Zona Oeste", "Zona Leste", "Zona Norte", "Região Metropolitana", "Não Classificado"]
    por_regiao = {}
    for reg in ordem_regioes:
        if reg in regioes_dict:
            bloco = calcular_bloco_estatistico(regioes_dict[reg])
            bairros_reg = [b for b in bairros_lista if b["regiao"] == reg and b["qtd_imoveis"] >= 10]
            bloco["qtd_bairros"] = len([b for b in bairros_lista if b["regiao"] == reg])
            bloco["mais_caros"] = sorted(bairros_reg, key=lambda x: x["aluguel_medio"], reverse=True)[:5]
            bloco["mais_acessiveis"] = sorted(bairros_reg, key=lambda x: x["aluguel_medio"])[:5]
            por_regiao[reg] = bloco

    # 4. Rankings Globais (n >= 15)
    bairros_representativos = [b for b in bairros_lista if b["qtd_imoveis"] >= 15]
    top_mais_caros = sorted(bairros_representativos, key=lambda x: x["aluguel_medio"], reverse=True)[:10]
    top_mais_acessiveis = sorted(bairros_representativos, key=lambda x: x["aluguel_medio"])[:10]

    zonas_capital = {"Centro", "Zona Norte", "Zona Sul", "Zona Leste", "Zona Oeste"}
    bairros_rep_capital = [b for b in bairros_representativos if b["regiao"] in zonas_capital]
    top_mais_caros_capital = sorted(bairros_rep_capital, key=lambda x: x["aluguel_medio"], reverse=True)[:10]
    top_mais_acessiveis_capital = sorted(bairros_rep_capital, key=lambda x: x["aluguel_medio"])[:10]

    payload = {
        "geral": stats_global,
        "por_regiao": por_regiao,
        "bairros": bairros_lista,
        "anuncios": anuncios_export,
        "total_bairros": len(bairros_lista),
        "bairros_com_coords": len([b for b in bairros_lista if b["has_coords"]]),
        "por_tipo": stats_global["por_tipo"],
        "por_quartos": stats_global["por_quartos"],
        "por_vagas": stats_global["por_vagas"],
        "por_faixa_area": stats_global["por_faixa_area"],
        "rankings": {
            "criterio": "Apenas bairros com pelo menos 15 anúncios (n >= 15)",
            "mais_caros": top_mais_caros,
            "mais_acessiveis": top_mais_acessiveis,
            "mais_caros_capital": top_mais_caros_capital,
            "mais_acessiveis_capital": top_mais_acessiveis_capital
        }
    }

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    with open(OUT_JS, "w", encoding="utf-8") as f:
        f.write("/* Dados gerados automaticamente pelo pipeline do Desafio SYNAPTA */\n")
        f.write("window.HOUSING_DATA = ")
        json.dump(payload, f, ensure_ascii=False)
        f.write(";\n")

    zones_size = os.path.getsize(OUT_ZONES_JS) if os.path.exists(OUT_ZONES_JS) else 0
    print(f"Sucesso! sp_zones.js: {zones_size / 1024:.1f} KB")
    print(f"Bairros com coordenadas: {payload['bairros_com_coords']} ({sum(b['qtd_imoveis'] for b in bairros_lista if b['has_coords'])} imóveis)")
    for reg, st in por_regiao.items():
        print(f"  - {reg}: {st['total_anuncios']} imóveis | Média R$ {st['aluguel_medio']} | Mediana R$ {st['aluguel_mediano']}")

    return payload


if __name__ == "__main__":
    carregar_e_processar()
