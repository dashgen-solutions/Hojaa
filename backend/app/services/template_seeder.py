"""
Seed predefined system document templates on startup.

These templates follow standard professional formats for common business
documents: proposals, SOWs, contracts, NDAs, and invoices.
"""
from uuid import uuid4
from sqlalchemy.orm import Session as DBSession
from app.models.database import DocumentTemplate
from app.core.logger import get_logger

logger = get_logger(__name__)

# ── Template Content Definitions ─────────────────────────────

def _text(t: str, styles=None):
    return {"type": "text", "text": t, "styles": styles or {}}


def _heading(text: str, level: int = 1):
    return {
        "type": "heading",
        "props": {"level": level},
        "content": [_text(text)],
        "children": [],
    }


def _para(text: str, bold=False):
    return {
        "type": "paragraph",
        "content": [_text(text, {"bold": True} if bold else {})],
        "children": [],
    }


def _bullet(text: str):
    return {
        "type": "bulletListItem",
        "content": [_text(text)],
        "children": [],
    }


def _numbered(text: str):
    return {
        "type": "numberedListItem",
        "content": [_text(text)],
        "children": [],
    }


# ─────────────────────────────────────────────────────────────

SYSTEM_TEMPLATES = [
    # ── Proposal ─────────────────────────────────────────────
    {
        "name": "Professional Proposal",
        "description": "A comprehensive project proposal with executive summary, scope, timeline, pricing, and terms.",
        "category": "Proposal",
        "variables": [
            {"name": "project.name", "label": "Project Name", "default_value": "", "source": "project"},
            {"name": "org.name", "label": "Organization", "default_value": "", "source": "org"},
            {"name": "date.today", "label": "Date", "default_value": "", "source": "system"},
            {"name": "team.members", "label": "Team Members", "default_value": "", "source": "team"},
        ],
        "content": [
            _heading("{{project.name}} — Project Proposal"),
            _para("Prepared by {{org.name}} | {{date.today}}"),
            _heading("Executive Summary", 2),
            _para("Provide a brief overview of the project, its objectives, and the value it delivers to the client. This should be 2-3 paragraphs that set the context for the entire proposal."),
            _heading("Project Overview", 2),
            _para("Describe the background of the project, the problem being solved, and the proposed approach."),
            _heading("Objectives & Goals", 3),
            _bullet("Define primary business objectives"),
            _bullet("List measurable success criteria"),
            _bullet("Identify key performance indicators"),
            _heading("Scope of Work", 2),
            _para("Detail the specific deliverables and work items included in this proposal."),
            _heading("In Scope", 3),
            _bullet("Feature/deliverable 1 — Description"),
            _bullet("Feature/deliverable 2 — Description"),
            _bullet("Feature/deliverable 3 — Description"),
            _heading("Out of Scope", 3),
            _bullet("Items explicitly excluded from this engagement"),
            _heading("Timeline & Milestones", 2),
            _para("Outline the project timeline with key milestones and delivery dates."),
            _numbered("Phase 1: Discovery & Planning — 2 weeks"),
            _numbered("Phase 2: Design — 3 weeks"),
            _numbered("Phase 3: Development — 6 weeks"),
            _numbered("Phase 4: Testing & QA — 2 weeks"),
            _numbered("Phase 5: Launch & Support — 1 week"),
            _heading("Team", 2),
            _para("Team members: {{team.members}}"),
            _heading("Pricing", 2),
            _para("See the pricing table below for a detailed cost breakdown. Use the Pricing panel to add line items."),
            _heading("Terms & Conditions", 2),
            _bullet("Payment terms: 50% upfront, 50% on delivery"),
            _bullet("This proposal is valid for 30 days from the date above"),
            _bullet("All intellectual property transfers upon final payment"),
            _heading("Next Steps", 2),
            _numbered("Review and approve this proposal"),
            _numbered("Sign the agreement"),
            _numbered("Kick-off meeting scheduled within 5 business days"),
        ],
    },

    # ── Statement of Work ────────────────────────────────────
    {
        "name": "Statement of Work (SOW)",
        "description": "Detailed SOW defining deliverables, acceptance criteria, responsibilities, and payment schedule.",
        "category": "SOW",
        "variables": [
            {"name": "project.name", "label": "Project Name", "default_value": "", "source": "project"},
            {"name": "org.name", "label": "Organization", "default_value": "", "source": "org"},
            {"name": "date.today", "label": "Date", "default_value": "", "source": "system"},
        ],
        "content": [
            _heading("Statement of Work — {{project.name}}"),
            _para("Prepared by: {{org.name}} | Effective Date: {{date.today}}"),
            _heading("1. Purpose", 2),
            _para("This Statement of Work describes the services, deliverables, and timeline for the {{project.name}} project."),
            _heading("2. Background", 2),
            _para("Provide context about the client's needs, the business problem, and why this project was initiated."),
            _heading("3. Scope of Services", 2),
            _heading("3.1 Deliverables", 3),
            _numbered("Deliverable 1 — Description and acceptance criteria"),
            _numbered("Deliverable 2 — Description and acceptance criteria"),
            _numbered("Deliverable 3 — Description and acceptance criteria"),
            _heading("3.2 Assumptions", 3),
            _bullet("Client will provide timely feedback within 3 business days"),
            _bullet("Access to required systems will be provided"),
            _bullet("Content and assets will be supplied by the client"),
            _heading("3.3 Exclusions", 3),
            _bullet("Items not included in this statement of work"),
            _heading("4. Roles & Responsibilities", 2),
            _heading("4.1 Provider Responsibilities", 3),
            _bullet("Project management and coordination"),
            _bullet("Design, development, and testing"),
            _bullet("Regular status reporting"),
            _heading("4.2 Client Responsibilities", 3),
            _bullet("Timely review and approval of deliverables"),
            _bullet("Providing necessary content and access"),
            _bullet("Designating a primary point of contact"),
            _heading("5. Timeline", 2),
            _para("Detail the project timeline with milestones."),
            _heading("6. Acceptance Criteria", 2),
            _para("Each deliverable will be considered accepted when the client provides written approval or after 5 business days with no feedback."),
            _heading("7. Payment Schedule", 2),
            _numbered("30% upon signing"),
            _numbered("30% upon milestone 2 completion"),
            _numbered("40% upon final delivery and acceptance"),
            _heading("8. Change Management", 2),
            _para("Any changes to the scope described herein must be documented in a written Change Order signed by both parties."),
            _heading("9. Signatures", 2),
            _para("Provider: ____________________  Date: ________"),
            _para("Client:   ____________________  Date: ________"),
        ],
    },

    # ── Contract / Agreement ─────────────────────────────────
    {
        "name": "Service Agreement",
        "description": "Standard service agreement covering terms, IP, liability, termination, and confidentiality.",
        "category": "Contract",
        "variables": [
            {"name": "project.name", "label": "Project Name", "default_value": "", "source": "project"},
            {"name": "org.name", "label": "Company", "default_value": "", "source": "org"},
            {"name": "date.today", "label": "Date", "default_value": "", "source": "system"},
        ],
        "content": [
            _heading("Service Agreement"),
            _para("This Service Agreement (\"Agreement\") is entered into as of {{date.today}} by and between {{org.name}} (\"Provider\") and _____________________ (\"Client\")."),
            _heading("1. Services", 2),
            _para("Provider agrees to perform the services described in the attached Statement of Work for the {{project.name}} project."),
            _heading("2. Compensation", 2),
            _para("Client shall pay Provider in accordance with the pricing and payment terms outlined in the Statement of Work."),
            _heading("3. Term & Termination", 2),
            _para("This Agreement is effective as of the date first written above and shall continue until all services are completed, unless terminated earlier."),
            _bullet("Either party may terminate with 30 days written notice"),
            _bullet("Client pays for all work completed through the termination date"),
            _heading("4. Intellectual Property", 2),
            _para("All work product created under this Agreement shall be the property of the Client upon full payment. Provider retains the right to use general knowledge and techniques."),
            _heading("5. Confidentiality", 2),
            _para("Both parties agree to hold confidential all proprietary information disclosed during the course of this engagement."),
            _heading("6. Limitation of Liability", 2),
            _para("Provider's total liability shall not exceed the total fees paid under this Agreement."),
            _heading("7. Indemnification", 2),
            _para("Each party shall indemnify the other against any third-party claims arising from a breach of this Agreement."),
            _heading("8. Governing Law", 2),
            _para("This Agreement shall be governed by the laws of _____________."),
            _heading("9. Entire Agreement", 2),
            _para("This Agreement constitutes the entire agreement between the parties and supersedes all prior agreements."),
            _heading("10. Signatures", 2),
            _para("Provider: ____________________  Date: ________"),
            _para("Client:   ____________________  Date: ________"),
        ],
    },

    # ── NDA ──────────────────────────────────────────────────
    {
        "name": "Non-Disclosure Agreement",
        "description": "Mutual NDA for protecting confidential information shared between parties.",
        "category": "NDA",
        "variables": [
            {"name": "org.name", "label": "Company", "default_value": "", "source": "org"},
            {"name": "date.today", "label": "Date", "default_value": "", "source": "system"},
        ],
        "content": [
            _heading("Mutual Non-Disclosure Agreement"),
            _para("This Mutual Non-Disclosure Agreement (\"Agreement\") is entered into as of {{date.today}} by and between {{org.name}} (\"Party A\") and _____________________ (\"Party B\")."),
            _heading("1. Purpose", 2),
            _para("The parties wish to explore a business relationship and, in connection with this, may share confidential information with each other."),
            _heading("2. Definition of Confidential Information", 2),
            _para("\"Confidential Information\" means any information disclosed by either party, directly or indirectly, in writing, orally, or by inspection, including but not limited to:"),
            _bullet("Business plans, strategies, and financial data"),
            _bullet("Technical data, trade secrets, and know-how"),
            _bullet("Product plans, designs, and source code"),
            _bullet("Customer lists and marketing strategies"),
            _heading("3. Obligations", 2),
            _bullet("Receiving party shall not disclose Confidential Information to third parties"),
            _bullet("Receiving party shall use Confidential Information solely for the stated purpose"),
            _bullet("Receiving party shall protect Confidential Information with reasonable care"),
            _heading("4. Exclusions", 2),
            _para("Confidential Information does not include information that:"),
            _bullet("Is or becomes publicly available without breach of this Agreement"),
            _bullet("Was already known by the receiving party"),
            _bullet("Is independently developed without reference to confidential information"),
            _heading("5. Duration", 2),
            _para("This Agreement shall remain in effect for 2 years from the date above. Obligations of confidentiality survive termination."),
            _heading("6. Return of Information", 2),
            _para("Upon termination or request, each party shall return or destroy all confidential materials."),
            _heading("7. Signatures", 2),
            _para("Party A: ____________________  Date: ________"),
            _para("Party B: ____________________  Date: ________"),
        ],
    },

    # ── Invoice ──────────────────────────────────────────────
    {
        "name": "Professional Invoice",
        "description": "Clean invoice template with line items, payment terms, and bank details.",
        "category": "Invoice",
        "variables": [
            {"name": "project.name", "label": "Project Name", "default_value": "", "source": "project"},
            {"name": "org.name", "label": "Company", "default_value": "", "source": "org"},
            {"name": "date.today", "label": "Date", "default_value": "", "source": "system"},
        ],
        "content": [
            _heading("INVOICE"),
            _para("From: {{org.name}}"),
            _para("Date: {{date.today}}"),
            _para("Invoice #: INV-001"),
            _heading("Bill To", 2),
            _para("Client Name: _____________________"),
            _para("Address: _____________________"),
            _para("Email: _____________________"),
            _heading("Project", 2),
            _para("{{project.name}}"),
            _heading("Line Items", 2),
            _para("Use the Pricing panel on the right to add detailed line items with quantities, rates, and totals."),
            _heading("Payment Details", 2),
            _para("Payment Due: Within 30 days of invoice date"),
            _para("Payment Method: Bank Transfer / Wire"),
            _heading("Bank Details", 3),
            _para("Bank: _____________________"),
            _para("Account: _____________________"),
            _para("Routing: _____________________"),
            _heading("Notes", 2),
            _para("Thank you for your business! Please feel free to contact us with any questions about this invoice."),
        ],
    },

    # ── Technical Specification ───────────────────────────────
    {
        "name": "Technical Specification",
        "description": "Detailed technical spec covering architecture, APIs, data models, and deployment.",
        "category": "Proposal",
        "variables": [
            {"name": "project.name", "label": "Project Name", "default_value": "", "source": "project"},
            {"name": "date.today", "label": "Date", "default_value": "", "source": "system"},
            {"name": "team.members", "label": "Team", "default_value": "", "source": "team"},
        ],
        "content": [
            _heading("{{project.name}} — Technical Specification"),
            _para("Version 1.0 | {{date.today}}"),
            _heading("1. Overview", 2),
            _para("High-level description of the system being built, its purpose, and the problem it solves."),
            _heading("2. Architecture", 2),
            _para("Describe the system architecture, components, and their interactions. Use the AI assistant to generate architecture diagrams."),
            _heading("2.1 System Components", 3),
            _bullet("Frontend — Technology, framework, hosting"),
            _bullet("Backend — Language, framework, API style"),
            _bullet("Database — Type, schema approach"),
            _bullet("Infrastructure — Cloud provider, deployment"),
            _heading("2.2 Data Flow", 3),
            _para("Describe how data flows through the system from user input to storage and back."),
            _heading("3. API Design", 2),
            _para("Document the key API endpoints, request/response formats, and authentication."),
            _heading("4. Data Model", 2),
            _para("Describe the core entities, their relationships, and storage strategy."),
            _heading("5. Security", 2),
            _bullet("Authentication mechanism"),
            _bullet("Authorization and role-based access"),
            _bullet("Data encryption at rest and in transit"),
            _bullet("Input validation strategy"),
            _heading("6. Performance Requirements", 2),
            _bullet("Expected response times"),
            _bullet("Concurrent user capacity"),
            _bullet("Data volume expectations"),
            _heading("7. Testing Strategy", 2),
            _bullet("Unit testing approach and coverage targets"),
            _bullet("Integration testing plan"),
            _bullet("End-to-end testing strategy"),
            _heading("8. Deployment", 2),
            _para("Describe the deployment strategy, CI/CD pipeline, and environment management."),
            _heading("9. Team", 2),
            _para("{{team.members}}"),
        ],
    },

    # ── Project Plan / Kickoff ────────────────────────────────
    {
        "name": "Project Kickoff Plan",
        "description": "Project kickoff document covering goals, team, communication plan, risks, and first sprint.",
        "category": "SOW",
        "variables": [
            {"name": "project.name", "label": "Project Name", "default_value": "", "source": "project"},
            {"name": "org.name", "label": "Organization", "default_value": "", "source": "org"},
            {"name": "date.today", "label": "Date", "default_value": "", "source": "system"},
            {"name": "team.members", "label": "Team Members", "default_value": "", "source": "team"},
        ],
        "content": [
            _heading("{{project.name}} — Kickoff Plan"),
            _para("Prepared by {{org.name}} | {{date.today}}"),
            _heading("Project Goals", 2),
            _para("Define the primary goals and success metrics for this project."),
            _numbered("Goal 1 — Description"),
            _numbered("Goal 2 — Description"),
            _numbered("Goal 3 — Description"),
            _heading("Team & Roles", 2),
            _para("Team: {{team.members}}"),
            _heading("Communication Plan", 2),
            _bullet("Daily standup: 15 min, 9:00 AM"),
            _bullet("Weekly status report: Every Friday"),
            _bullet("Sprint review: Bi-weekly"),
            _bullet("Primary channel: Slack / Email"),
            _heading("Key Milestones", 2),
            _numbered("Milestone 1 — Target date"),
            _numbered("Milestone 2 — Target date"),
            _numbered("Milestone 3 — Target date"),
            _heading("Risks & Mitigations", 2),
            _bullet("Risk 1: Description → Mitigation strategy"),
            _bullet("Risk 2: Description → Mitigation strategy"),
            _heading("Tools & Resources", 2),
            _bullet("Project management: Hojaa"),
            _bullet("Version control: Git"),
            _bullet("Communication: Slack"),
            _heading("First Sprint Plan", 2),
            _para("Outline the tasks and goals for the first sprint/iteration."),
        ],
    },
]


def seed_system_templates(db: DBSession) -> int:
    """
    Seed predefined system templates if they don't already exist.
    Returns the number of templates created.
    """
    existing_names = {
        t.name for t in
        db.query(DocumentTemplate.name)
        .filter(DocumentTemplate.is_system == True)
        .all()
    }

    created = 0
    for tmpl_data in SYSTEM_TEMPLATES:
        if tmpl_data["name"] in existing_names:
            continue

        template = DocumentTemplate(
            id=uuid4(),
            organization_id=None,
            created_by=None,
            name=tmpl_data["name"],
            description=tmpl_data["description"],
            category=tmpl_data["category"],
            content=tmpl_data["content"],
            variables=tmpl_data.get("variables", []),
            is_system=True,
            is_active=True,
        )
        db.add(template)
        created += 1

    if created > 0:
        db.commit()
        logger.info(f"Seeded {created} system document templates")

    return created
