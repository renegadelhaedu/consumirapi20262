import unittest
from unittest.mock import patch, Mock
import requests
from app import app

class FlaskAppTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        app.config["TESTING"] = True

    def test_index_route(self):
        """Verifica se a página inicial carrega com status 200 e contém elementos-chave."""
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        html = response.data.decode("utf-8")
        self.assertIn("Consumidor de API JSON", html)
        self.assertIn("Carregar Dados", html)
        self.assertIn("id=\"endpointInput\"", html)

    def test_consumir_sem_url_usa_default(self):
        """Verifica se omitir a URL consome o endpoint default sem erros."""
        response = self.client.post("/api/consumir", json={})
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["status_code"], 200)
        self.assertIsInstance(data["data"], list)
        self.assertGreater(data["count"], 0)

    def test_consumir_url_invalida(self):
        """Verifica se URLs sem http:// ou https:// retornam erro 400."""
        response = self.client.post("/api/consumir", json={"url": "ftp://servidor.invalido"})
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertFalse(data["success"])
        self.assertIn("URL inválida", data["error"])

    @patch("requests.get")
    def test_consumir_sucesso_mock(self, mock_get):
        """Testa o fluxo de sucesso com dados simulados."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"id": 1, "nome": "Produto Teste", "preco": 49.90},
            {"id": 2, "nome": "Outro Produto", "preco": 99.00}
        ]
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        response = self.client.post("/api/consumir", json={"url": "https://api.fake.com/produtos"})
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["count"], 2)
        self.assertEqual(data["data"][0]["nome"], "Produto Teste")

    @patch("requests.get")
    def test_consumir_timeout_mock(self, mock_get):
        """Testa comportamento quando ocorre timeout."""
        mock_get.side_effect = requests.exceptions.Timeout("Timeout!")
        response = self.client.post("/api/consumir", json={"url": "https://api.lenta.com/dados"})
        self.assertEqual(response.status_code, 504)
        data = response.get_json()
        self.assertFalse(data["success"])
        self.assertIn("Tempo limite excedido", data["error"])

if __name__ == "__main__":
    unittest.main()
