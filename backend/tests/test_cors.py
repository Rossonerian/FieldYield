ALLOWED_ORIGIN = "https://field-yield.vercel.app"


def test_production_origin_is_allowed(client):
    response = client.options(
        "/api/v1/auth/register",
        headers={
            "Origin": ALLOWED_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert "POST" in response.headers["access-control-allow-methods"]
    assert "authorization" in response.headers["access-control-allow-headers"].lower()


def test_localhost_origin_is_blocked(client):
    response = client.options(
        "/api/v1/auth/register",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
    )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_protected_route_unauthorized_response_keeps_cors_headers(client):
    response = client.get(
        "/api/v1/users/me",
        headers={"Origin": ALLOWED_ORIGIN},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Unauthorized"}
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert response.headers["access-control-allow-credentials"] == "true"


def test_invalid_login_is_401_and_keeps_cors_headers(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "missing@example.com", "password": "wrong-password"},
        headers={"Origin": ALLOWED_ORIGIN},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid credentials"}
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert response.headers["access-control-allow-credentials"] == "true"


def test_valid_login_and_protected_route_keep_cors_headers(client):
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "cors-user@example.com",
            "password": "password123",
            "date_of_birth": "1990-01-01T00:00:00Z",
        },
    )
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "cors-user@example.com", "password": "password123"},
        headers={"Origin": ALLOWED_ORIGIN},
    )

    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    response = client.get(
        "/api/v1/users/me",
        headers={"Origin": ALLOWED_ORIGIN, "Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert response.headers["access-control-allow-credentials"] == "true"


def test_preflight_for_auth_protected_routes_succeeds_before_auth(client):
    response = client.options(
        "/api/v1/users/me",
        headers={
            "Origin": ALLOWED_ORIGIN,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
