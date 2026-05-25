"""Tests for GET /api/search — response shape with mocked embeddings/DB."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from find_api.core.database import get_db
from find_api.main import app


def _mock_search(client, fake_rows):
    """Call /api/search with a mocked embedder and mocked DB execute."""
    mock_embedder = MagicMock()
    mock_embedder.embed_text.return_value = [0.0] * 768

    mock_count_result = MagicMock()
    mock_count_result.scalar.return_value = len(fake_rows)

    mock_search_result = MagicMock()
    mock_search_result.fetchall.return_value = fake_rows

    mock_db = MagicMock()
    mock_db.execute.side_effect = [mock_count_result, mock_search_result]

    def _override():
        yield mock_db

    app.dependency_overrides[get_db] = _override

    try:
        with (
            patch(
                "find_api.routers.search.settings",
                ML_MODE="mock",
                EMBEDDING_DIM=768,
            ),
            patch(
                "find_api.ml.mock_embedder.get_mock_embedder",
                return_value=mock_embedder,
            ),
        ):
            return client.get("/api/search", params={"q": "sunset"})
    finally:
        app.dependency_overrides.pop(get_db, None)

class TestSearchResponseShape:
    """Search response shape with mocked data."""

    def test_search_result_shape(self, client):
        fake_row = MagicMock(
            id=1,
            filename="beach.jpg",
            minio_key="images/ab/abc.jpg",
            thumbnail_key="thumbnails/ab/abc.webp",
            thumbnail_content_type="image/webp",
            thumbnail_size=512,
            thumbnail_width=256,
            thumbnail_height=144,
            status="indexed",
            liked=False,
            width=1920,
            height=1080,
            cluster_id=None,
            similarity=0.82,
            metadata_json='{"caption": "a beach", "objects": ["sand"]}',
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )

        response = _mock_search(client, [fake_row])

        assert response.status_code == 200
        body = response.json()
        assert body["query"] == "sunset"
        assert "results" in body
        assert isinstance(body["results"], list)
        assert "total" in body
        assert "page" in body
        assert "limit" in body
        assert "skip" in body
        assert "has_more" in body

    def test_empty_results(self, client):
        response = _mock_search(client, [])

        body = response.json()
        assert body["results"] == []
        assert body["total"] == 0

    def test_missing_query_returns_422(self, client):
        response = client.get("/api/search")
        assert response.status_code == 422

class TestSearchDiagnostics:
    """Tests for the debug diagnostics response behavior."""

    def _mock_search_with_debug(self, client, fake_rows, debug: bool, environment: str):
        """Call /api/search with debug param and a controlled environment."""
        mock_embedder = MagicMock()
        mock_embedder.embed_text.return_value = [0.0] * 768

        # count result (first execute call)
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = int(len(fake_rows))

        # search result (second execute call)
        mock_search_result = MagicMock()
        mock_search_result.fetchall.return_value = fake_rows

        mock_db = MagicMock()
        mock_db.execute.side_effect = [mock_count_result, mock_search_result]

        def _override():
            yield mock_db

        app.dependency_overrides[get_db] = _override

        try:
            with (
                patch(
                    "find_api.routers.search.settings",
                    ML_MODE="mock",
                    EMBEDDING_DIM=768,
                    ENVIRONMENT=environment,
                ),
                patch(
                    "find_api.ml.mock_embedder.get_mock_embedder",
                    return_value=mock_embedder,
                ),
            ):
                return client.get(
                    "/api/search", params={"q": "sunset", "debug": str(debug).lower()}
                )
        finally:
            app.dependency_overrides.pop(get_db, None)

    def test_diagnostics_present_when_debug_true_local(self, client):
        """diagnostics block is returned when debug=True in local environment."""
        response = self._mock_search_with_debug(client, [], debug=True, environment="local")

        assert response.status_code == 200
        body = response.json()
        assert "diagnostics" in body
        diag = body["diagnostics"]
        assert "embedding_ms" in diag
        assert "retrieval_ms" in diag
        assert "total_ms" in diag
        assert "results_returned" in diag
        assert "similarity_threshold" in diag
        assert "ml_mode" in diag
        assert isinstance(diag["embedding_ms"], float)
        assert isinstance(diag["retrieval_ms"], float)
        assert isinstance(diag["total_ms"], float)
        assert isinstance(diag["results_returned"], int)

    def test_diagnostics_present_when_debug_true_development(self, client):
        """diagnostics block is returned when debug=True in development environment."""
        response = self._mock_search_with_debug(client, [], debug=True, environment="development")

        assert response.status_code == 200
        assert "diagnostics" in response.json()

    def test_diagnostics_absent_when_debug_false(self, client):
        """diagnostics block is NOT returned when debug=False."""
        response = self._mock_search_with_debug(client, [], debug=False, environment="local")

        assert response.status_code == 200
        assert "diagnostics" not in response.json()

    def test_diagnostics_absent_in_production(self, client):
        """diagnostics block is NOT returned in production even if debug=True."""
        response = self._mock_search_with_debug(client, [], debug=True, environment="production")

        assert response.status_code == 200
        assert "diagnostics" not in response.json()

    def test_diagnostics_absent_in_staging(self, client):
        """diagnostics block is NOT returned in staging even if debug=True."""
        response = self._mock_search_with_debug(client, [], debug=True, environment="staging")

        assert response.status_code == 200
        assert "diagnostics" not in response.json()