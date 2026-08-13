from .conftest import auth

def test_oversell_is_rejected(client):
    headers = auth(client)
    client.post("/api/v1/wallet/credit", json={"currency":"gold","amount":"1000"}, headers=headers)
    result = client.post("/api/v1/trading/orders/market-sell", json={"symbol":"HA9","quantity":1}, headers=headers)
    assert result.status_code == 409
    assert result.json()["detail"] == "Insufficient holdings"

