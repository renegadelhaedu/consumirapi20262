import os
import requests
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

DEFAULT_ENDPOINT = "http://192.168.25.111:5122/api/alunos"

@app.route("/")
def index():
    return render_template("index.html", default_endpoint=DEFAULT_ENDPOINT)

@app.route("/api/consumir", methods=["GET", "POST"])
def consumir_api():
   
    if request.method == "POST":
        payload = request.get_json(silent=True) or request.form
        endpoint_url = payload.get("url") if payload else None
    else:
        endpoint_url = request.args.get("url")

    if not endpoint_url or not endpoint_url.strip():
        endpoint_url = DEFAULT_ENDPOINT
    else:
        endpoint_url = endpoint_url.strip()

    if not (endpoint_url.startswith("http://") or endpoint_url.startswith("https://")):
        return jsonify({
            "success": False,
            "error": "URL inválida. O endereço deve começar com 'http://' ou 'https://'."
        }), 400

    try:
        headers = {
            "User-Agent": "Flask-JSON-Consumer/1.0",
            "Accept": "application/json"
        }
        response = requests.get(endpoint_url, headers=headers, timeout=12)
        response.raise_for_status()

        try:
            data = response.json()
        except ValueError:
            return jsonify({
                "success": False,
                "error": "A resposta da URL informada não é um formato JSON válido.",
                "status_code": response.status_code
            }), 422

        item_count = len(data) if isinstance(data, list) else (len(data.keys()) if isinstance(data, dict) else 1)

        return jsonify({
            "success": True,
            "url": endpoint_url,
            "status_code": response.status_code,
            "count": item_count,
            "data": data
        })

    except requests.exceptions.Timeout:
        return jsonify({
            "success": False,
            "error": "Tempo limite excedido ao tentar conectar ao endpoint externo (timeout de 12 segundos)."
        }), 504

    except requests.exceptions.ConnectionError:
        return jsonify({
            "success": False,
            "error": "Não foi possível conectar ao servidor externo. Verifique a URL e a sua conexão com a internet."
        }), 502

    except requests.exceptions.HTTPError as http_err:
        return jsonify({
            "success": False,
            "error": f"Erro retornado pelo servidor externo: {http_err}",
            "status_code": response.status_code if 'response' in locals() else None
        }), 502

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Erro inesperado ao consumir o endpoint: {str(e)}"
        }), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
