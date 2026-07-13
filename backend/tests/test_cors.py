def test_production_origin_is_allowed(client):
    response = client.options(
        "/api/v1/auth/register",
        headers={
            "Origin": "https://your-app.vercel.app",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://your-app.vercel.app"
    assert "POST" in response.headers["access-control-allow-methods"]


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
