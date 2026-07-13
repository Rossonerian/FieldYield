from .conftest import auth

def test_non_epl_asset_is_rejected(client):
    headers = auth(client)
    client.post("/api/v1/wallet/credit", json={"currency":"gold","amount":"1000"}, headers=headers)
    result = client.post("/api/v1/trading/orders/market-buy", json={"symbol":"UNKNOWN","quantity":1}, headers=headers)
    assert result.status_code == 400

