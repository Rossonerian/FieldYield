from .conftest import auth

def test_credit_has_ledger_and_is_idempotent(client):
    headers = auth(client); payload = {"currency":"gold","amount":"1000","idempotency_key":"credit-1"}
    assert client.post("/api/v1/wallet/credit", json=payload, headers=headers).status_code == 200
    client.post("/api/v1/wallet/credit", json=payload, headers=headers)
    assert client.get("/api/v1/wallet", headers=headers).json()["gold"] == 1000
    assert len(client.get("/api/v1/wallet/ledger", headers=headers).json()) == 1

