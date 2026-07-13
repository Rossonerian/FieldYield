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
