from .conftest import auth

def test_watchlist_is_owned_and_unique(client):
    headers = auth(client)
    assert client.post("/api/v1/watchlists", json={"symbol": "HA9"}, headers=headers).status_code == 201
    assert client.post("/api/v1/watchlists", json={"symbol": "HA9"}, headers=headers).status_code == 409
    assert len(client.get("/api/v1/watchlists", headers=headers).json()) == 1
    assert client.delete("/api/v1/watchlists/HA9", headers=headers).status_code == 204
    assert client.get("/api/v1/watchlists", headers=headers).json() == []
