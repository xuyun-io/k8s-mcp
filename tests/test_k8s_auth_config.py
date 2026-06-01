from kubernetes import client

from k8s_mcp.server.providers import normalize_bearer_token_auth


def test_normalize_bearer_token_auth_maps_authorization_key():
    config = client.Configuration()
    config.api_key["authorization"] = "Bearer token-value"

    normalize_bearer_token_auth(config)

    assert config.auth_settings()["BearerToken"]["value"] == "Bearer token-value"


def test_normalize_bearer_token_auth_respects_authorization_prefix():
    config = client.Configuration()
    config.api_key["authorization"] = "token-value"
    config.api_key_prefix["authorization"] = "Bearer"

    normalize_bearer_token_auth(config)

    assert config.auth_settings()["BearerToken"]["value"] == "Bearer token-value"


def test_normalize_bearer_token_auth_does_not_overwrite_existing_bearer_token():
    config = client.Configuration()
    config.api_key["authorization"] = "Bearer stale-token"
    config.api_key["BearerToken"] = "Bearer current-token"

    normalize_bearer_token_auth(config)

    assert config.auth_settings()["BearerToken"]["value"] == "Bearer current-token"
