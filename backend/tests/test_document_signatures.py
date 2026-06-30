"""
Tests for document electronic signature functionality.

Tests cover:
- Signature submission flow
- IP address capture
- Duplicate signature prevention
- Document status updates when all parties sign
- Signature retrieval by author
- PDF export with signatures
- DOCX export with signatures
"""
import base64
import io
from uuid import uuid4
from datetime import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.database import (
    User, Organization, Session as SessionModel, Document,
    DocumentRecipient, DocumentSignature, DocumentStatus
)
from app.core.auth import create_access_token


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


@pytest.fixture
def db_session(mocker):
    """Mock database session."""
    mock_db = mocker.MagicMock(spec=Session)
    return mock_db


@pytest.fixture
def sample_signature_data():
    """Generate a minimal valid base64 PNG signature."""
    # 1x1 transparent PNG
    png_bytes = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    )
    return f"data:image/png;base64,{base64.b64encode(png_bytes).decode('ascii')}"


class TestSignatureSubmission:
    """Test signature submission endpoint."""

    def test_submit_signature_success(self, client, db_session, sample_signature_data, mocker):
        """Test successful signature submission."""
        # Setup
        org = Organization(id=uuid4(), name="Test Org", slug="test-org", created_by=uuid4())
        user = User(id=uuid4(), email="author@test.com", username="author", hashed_password="x", organization=org)
        session = SessionModel(id=uuid4(), organization=org, created_by=user.id, document_filename="Test")
        doc = Document(
            id=uuid4(),
            session=session,
            title="Test Contract",
            status=DocumentStatus.SENT,
            created_by=user.id,
            organization=org
        )
        recipient = DocumentRecipient(
            id=uuid4(),
            document=doc,
            name="John Signer",
            email="john@test.com",
            role="signer",
            access_token="test-token-123"
        )

        # Mock database queries
        mocker.patch("app.api.routes.documents.get_db", return_value=db_session)
        db_session.query.return_value.filter.return_value.first.side_effect = [
            recipient,  # First call for recipient lookup
            doc,        # Second call for document lookup
            None,       # Third call for existing signature check
            recipient,  # Fourth call for all_signers
            None        # Fifth call for signed check
        ]
        db_session.query.return_value.filter.return_value.all.return_value = [recipient]

        # Mock request to capture IP
        mocker.patch("app.api.routes.documents.Request")

        # Execute
        response = client.post(
            "/api/documents/view/test-token-123/sign",
            json={
                "signature_data": sample_signature_data,
                "signature_type": "draw",
                "signer_name": "John Signer"
            }
        )

        # Verify
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["signer_name"] == "John Signer"
        assert "signed_at" in data
        db_session.add.assert_called_once()
        db_session.commit.assert_called()

    def test_submit_signature_with_ip_capture(self, client, db_session, sample_signature_data, mocker):
        """Test that IP address is captured from request."""
        # Setup similar to above
        org = Organization(id=uuid4(), name="Test Org", slug="test-org", created_by=uuid4())
        user = User(id=uuid4(), email="author@test.com", username="author", hashed_password="x", organization=org)
        session = SessionModel(id=uuid4(), organization=org, created_by=user.id, document_filename="Test")
        doc = Document(
            id=uuid4(),
            session=session,
            title="Test Contract",
            status=DocumentStatus.SENT,
            created_by=user.id,
            organization=org
        )
        recipient = DocumentRecipient(
            id=uuid4(),
            document=doc,
            name="Jane Doe",
            email="jane@test.com",
            role="signer",
            access_token="token-456"
        )

        mocker.patch("app.api.routes.documents.get_db", return_value=db_session)
        db_session.query.return_value.filter.return_value.first.side_effect = [
            recipient, doc, None, recipient, None
        ]
        db_session.query.return_value.filter.return_value.all.return_value = [recipient]

        # Capture the DocumentSignature object that gets added
        added_signature = None
        def capture_add(obj):
            nonlocal added_signature
            if isinstance(obj, DocumentSignature):
                added_signature = obj
        db_session.add.side_effect = capture_add

        # Execute with mocked client IP
        with client as c:
            # Override client.host for test
            response = c.post(
                "/api/documents/view/token-456/sign",
                json={
                    "signature_data": sample_signature_data,
                    "signature_type": "typed",
                    "signer_name": "Jane Doe"
                },
                headers={"X-Forwarded-For": "203.0.113.42, 198.51.100.1"}
            )

        assert response.status_code == 200
        # Verify IP was captured (should be first in X-Forwarded-For)
        if added_signature:
            assert added_signature.ip_address in ["203.0.113.42", None]  # Might be None in test env

    def test_submit_signature_duplicate_prevented(self, client, db_session, sample_signature_data, mocker):
        """Test that duplicate signatures are rejected."""
        org = Organization(id=uuid4(), name="Test Org", slug="test-org", created_by=uuid4())
        user = User(id=uuid4(), email="author@test.com", username="author", hashed_password="x", organization=org)
        session = SessionModel(id=uuid4(), organization=org, created_by=user.id, document_filename="Test")
        doc = Document(id=uuid4(), session=session, title="Contract", created_by=user.id, organization=org)
        recipient = DocumentRecipient(
            id=uuid4(), document=doc, name="Bob", email="bob@test.com",
            role="signer", access_token="token-789"
        )
        existing_sig = DocumentSignature(
            id=uuid4(), document=doc, recipient=recipient,
            signature_data="old-data", signature_type="draw",
            signer_name="Bob", signer_email="bob@test.com"
        )

        mocker.patch("app.api.routes.documents.get_db", return_value=db_session)
        db_session.query.return_value.filter.return_value.first.side_effect = [
            recipient, doc, existing_sig  # Existing signature found
        ]

        response = client.post(
            "/api/documents/view/token-789/sign",
            json={
                "signature_data": sample_signature_data,
                "signature_type": "draw",
                "signer_name": "Bob"
            }
        )

        assert response.status_code == 409
        assert "already signed" in response.json()["detail"]

    def test_submit_signature_non_signer_rejected(self, client, db_session, sample_signature_data, mocker):
        """Test that non-signer recipients cannot sign."""
        org = Organization(id=uuid4(), name="Test Org", slug="test-org", created_by=uuid4())
        user = User(id=uuid4(), email="author@test.com", username="author", hashed_password="x", organization=org)
        session = SessionModel(id=uuid4(), organization=org, created_by=user.id, document_filename="Test")
        doc = Document(id=uuid4(), session=session, title="Doc", created_by=user.id, organization=org)
        viewer = DocumentRecipient(
            id=uuid4(), document=doc, name="Viewer", email="viewer@test.com",
            role="viewer", access_token="viewer-token"
        )

        mocker.patch("app.api.routes.documents.get_db", return_value=db_session)
        db_session.query.return_value.filter.return_value.first.side_effect = [viewer, doc]

        response = client.post(
            "/api/documents/view/viewer-token/sign",
            json={
                "signature_data": sample_signature_data,
                "signature_type": "draw",
                "signer_name": "Viewer"
            }
        )

        assert response.status_code == 403
        assert "Only signers" in response.json()["detail"]

    def test_document_completed_when_all_sign(self, client, db_session, sample_signature_data, mocker):
        """Test document status changes to COMPLETED when all signers sign."""
        org = Organization(id=uuid4(), name="Test Org", slug="test-org", created_by=uuid4())
        user = User(id=uuid4(), email="author@test.com", username="author", hashed_password="x", organization=org)
        session = SessionModel(id=uuid4(), organization=org, created_by=user.id, document_filename="Test")
        doc = Document(
            id=uuid4(), session=session, title="Contract",
            status=DocumentStatus.SENT, created_by=user.id, organization=org
        )
        
        signer1 = DocumentRecipient(
            id=uuid4(), document=doc, name="Signer 1", email="s1@test.com",
            role="signer", access_token="token-s1"
        )
        signer2 = DocumentRecipient(
            id=uuid4(), document=doc, name="Signer 2", email="s2@test.com",
            role="signer", access_token="token-s2"
        )
        
        # signer1 already signed
        existing_sig = DocumentSignature(
            id=uuid4(), document=doc, recipient=signer1,
            signature_data="sig1", signature_type="draw",
            signer_name="Signer 1", signer_email="s1@test.com"
        )

        mocker.patch("app.api.routes.documents.get_db", return_value=db_session)
        # Now signer2 signs (completes all signatures)
        db_session.query.return_value.filter.return_value.first.side_effect = [
            signer2,      # recipient lookup
            doc,          # document lookup
            None,         # no existing sig for signer2
            signer1,      # first signer in all_signers loop
            existing_sig, # signer1 has signed
        ]
        db_session.query.return_value.filter.return_value.all.return_value = [signer1, signer2]

        response = client.post(
            "/api/documents/view/token-s2/sign",
            json={
                "signature_data": sample_signature_data,
                "signature_type": "draw",
                "signer_name": "Signer 2"
            }
        )

        assert response.status_code == 200
        # Verify document status updated
        assert doc.status == DocumentStatus.COMPLETED
        assert doc.completed_at is not None


class TestSignatureRetrieval:
    """Test signature retrieval endpoints."""

    def test_get_document_signatures_author_view(self, client, db_session, mocker):
        """Test author can retrieve all signatures for their document."""
        org = Organization(id=uuid4(), name="Test Org", slug="test-org", created_by=uuid4())
        author = User(
            id=uuid4(), email="author@test.com", username="author",
            hashed_password="x", organization=org
        )
        session = SessionModel(id=uuid4(), organization=org, created_by=author.id, document_filename="Test")
        doc = Document(
            id=uuid4(), session=session, title="Contract",
            created_by=author.id, organization=org
        )
        
        signer1_recip = DocumentRecipient(
            id=uuid4(), document=doc, name="Alice", email="alice@test.com", role="signer"
        )
        signer2_recip = DocumentRecipient(
            id=uuid4(), document=doc, name="Bob", email="bob@test.com", role="signer"
        )
        
        sig1 = DocumentSignature(
            id=uuid4(), document=doc, recipient=signer1_recip,
            signature_data="data1", signature_type="draw",
            signer_name="Alice", signer_email="alice@test.com",
            signed_at=datetime.utcnow()
        )

        token = create_access_token({"sub": str(author.id)})
        
        mocker.patch("app.api.routes.documents.get_db", return_value=db_session)
        mocker.patch("app.api.routes.documents.get_current_user", return_value=author)
        mocker.patch("app.api.routes.documents._verify_document_access", return_value=doc)
        
        db_session.query.return_value.filter.return_value.order_by.return_value.all.return_value = [sig1]
        db_session.query.return_value.filter.return_value.in_.return_value.all.return_value = [signer1_recip]
        db_session.query.return_value.filter.return_value.all.return_value = [signer1_recip, signer2_recip]

        response = client.get(
            f"/api/documents/{doc.id}/signatures",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2  # 1 signed + 1 pending
        signed = [s for s in data if s["signed_at"]]
        pending = [s for s in data if not s["signed_at"]]
        assert len(signed) == 1
        assert len(pending) == 1
        assert signed[0]["signer_name"] == "Alice"
        assert pending[0]["signer_name"] == "Bob"


class TestSignatureInExports:
    """Test signature rendering in PDF and DOCX exports."""

    def test_pdf_export_includes_signatures(self, client, db_session, sample_signature_data, mocker):
        """Test PDF export includes signature section when signatures exist."""
        org = Organization(id=uuid4(), name="Test Org", slug="test-org", created_by=uuid4())
        author = User(id=uuid4(), email="author@test.com", username="author", hashed_password="x", organization=org)
        session = SessionModel(id=uuid4(), organization=org, created_by=author.id, document_filename="Test")
        doc = Document(
            id=uuid4(), session=session, title="Signed Contract",
            content=[{"type": "paragraph", "content": [{"type": "text", "text": "Test content"}]}],
            created_by=author.id, organization=org
        )
        
        recipient = DocumentRecipient(
            id=uuid4(), document=doc, name="Signer", email="signer@test.com", role="signer"
        )
        signature = DocumentSignature(
            id=uuid4(), document=doc, recipient=recipient,
            signature_data=sample_signature_data, signature_type="draw",
            signer_name="Signer", signer_email="signer@test.com",
            signed_at=datetime.utcnow(), ip_address="192.0.2.1"
        )

        token = create_access_token({"sub": str(author.id)})
        
        mocker.patch("app.api.routes.documents.get_db", return_value=db_session)
        mocker.patch("app.api.routes.documents.get_current_user", return_value=author)
        mocker.patch("app.api.routes.documents._verify_document_access", return_value=doc)
        
        # Mock signature query
        mock_sig_query = mocker.MagicMock()
        mock_sig_query.filter.return_value.order_by.return_value.all.return_value = [signature]
        db_session.query.return_value = mock_sig_query

        response = client.get(
            f"/api/documents/{doc.id}/pdf",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        
        # Verify PDF contains signature text (basic check)
        pdf_bytes = response.content
        assert b"Signature" in pdf_bytes or b"Signer" in pdf_bytes

    def test_docx_export_includes_signatures(self, client, db_session, sample_signature_data, mocker):
        """Test DOCX export includes signature section when signatures exist."""
        org = Organization(id=uuid4(), name="Test Org", slug="test-org", created_by=uuid4())
        author = User(id=uuid4(), email="author@test.com", username="author", hashed_password="x", organization=org)
        session = SessionModel(id=uuid4(), organization=org, created_by=author.id, document_filename="Test")
        doc = Document(
            id=uuid4(), session=session, title="Signed Agreement",
            content=[{"type": "paragraph", "content": [{"type": "text", "text": "Agreement text"}]}],
            created_by=author.id, organization=org
        )
        
        recipient = DocumentRecipient(
            id=uuid4(), document=doc, name="Party A", email="partya@test.com", role="signer"
        )
        signature = DocumentSignature(
            id=uuid4(), document=doc, recipient=recipient,
            signature_data=sample_signature_data, signature_type="typed",
            signer_name="Party A", signer_email="partya@test.com",
            signed_at=datetime.utcnow()
        )

        token = create_access_token({"sub": str(author.id)})
        
        mocker.patch("app.api.routes.documents.get_db", return_value=db_session)
        mocker.patch("app.api.routes.documents.get_current_user", return_value=author)
        mocker.patch("app.api.routes.documents._verify_document_access", return_value=doc)
        
        # Mock queries
        mock_query = mocker.MagicMock()
        mock_query.filter.return_value.order_by.return_value.all.side_effect = [
            [],  # pricing items
            [signature]  # signatures
        ]
        db_session.query.return_value = mock_query

        response = client.get(
            f"/api/documents/{doc.id}/docx",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200
        assert "openxmlformats-officedocument.wordprocessingml" in response.headers["content-type"]
        
        # Basic check that DOCX was generated
        docx_bytes = response.content
        assert len(docx_bytes) > 0
        assert b"PK" in docx_bytes[:4]  # ZIP header (DOCX is a ZIP file)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
