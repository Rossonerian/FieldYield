from .conftest import auth

def test_buy_and_sell_update_wallet_and_holdings(client):
    headers = auth(client)
    client.post("/api/v1/wallet/credit", json={"currency":"gold","amount":"1000"}, headers=headers)
    buy = client.post("/api/v1/trading/orders/market-buy", json={"symbol":"HA9","quantity":2}, headers=headers)
    assert buy.json()["status"] == "FILLED"
    assert client.get("/api/v1/portfolio", headers=headers).json()["cost_basis"] == 244
    sell = client.post("/api/v1/trading/orders/market-sell", json={"symbol":"HA9","quantity":1}, headers=headers)
    assert sell.json()["status"] == "FILLED"
