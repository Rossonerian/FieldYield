from .conftest import auth

def test_seeded_players_can_be_bought(client):
    headers = auth(client)
    client.post("/api/v1/wallet/credit", json={"currency":"gold","amount":"10000"}, headers=headers)
    for symbol in ("HA9", "SA7", "WI11"):
        assert client.post("/api/v1/trading/orders/market-buy", json={"symbol":symbol,"quantity":1}, headers=headers).json()["status"] == "FILLED"

