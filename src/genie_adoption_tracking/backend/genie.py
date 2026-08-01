"""In-app Genie chat assistant.

A thin proxy over the Databricks Genie Conversation API so the field can ask
natural-language questions about FINS Genie adoption — and get playbook guidance —
without leaving the app. The reasoning lives in a Genie Space (structured `gat_*`
data now; docs/deck via a UC Volume later); this router just relays messages.

Design choices (see the interactive-playbook design):
  * Calls Genie as the **app service principal** (`Dependencies.Client`) — works
    regardless of per-user auth scopes. The Space id comes from AppConfig
    (`genie_space_id`); when unset the endpoints report the assistant as disabled
    rather than erroring, so the app still runs without a Space configured.
  * **Account-aware:** when a request carries an `account_id`, that account's facts
    (stage, PP/AIM status, open blockers/issues) are prepended to the question so
    answers are tailored to the engagement.
  * Stateless follow-ups: the frontend passes back the `conversation_id` Genie
    returned, so multi-turn chats work without us persisting anything.
"""

from __future__ import annotations

import json

import requests
from sqlmodel import Session, select

from .core import Dependencies, create_router
from .db import Account, AccountIssue, Blocker, UseCase
from .models import (
    GenieAnswerOut,
    GenieAskIn,
    GenieStatusOut,
)
from . import playbook

router = create_router()


# --------------------------------------------------------------------------------------
# Account context — injected into the question so Genie tailors its answer
# --------------------------------------------------------------------------------------


def _account_context(session: Session, account_id: str) -> str:
    """A short natural-language preamble describing the account, so the assistant can
    recommend the right next step / demo / play for this specific engagement."""
    account = session.get(Account, account_id)
    if account is None:
        return ""

    use_cases = session.exec(
        select(UseCase).where(UseCase.account_id == account_id)
    ).all()
    # Furthest stage reached tells the model where the engagement is.
    max_order = max((playbook.stage_order(uc.stage) for uc in use_cases), default=-1)
    stage_name = next(
        (s["name"] for s in playbook.STAGES if s["order"] == max_order),
        "no active use case",
    )
    uc_ids = {uc.id for uc in use_cases}
    open_blockers = (
        session.exec(select(Blocker).where(Blocker.resolved == False)).all()  # noqa: E712
        if uc_ids
        else []
    )
    open_blockers = [b for b in open_blockers if b.use_case_id in uc_ids]
    open_issues = session.exec(
        select(AccountIssue).where(AccountIssue.account_id == account_id)
    ).all()
    open_issues = [
        i for i in open_issues if (i.status or "").lower() not in ("resolved", "will_not_solve")
    ]

    pp = account.pp_status
    pp_label = "enabled" if pp in ("on", "on_default") else pp
    parts = [
        "You are the Genie Field Adoption assistant helping a Databricks SA/SSA "
        "during a customer engagement. Give concise, actionable guidance: what demo "
        "to show, how to answer an objection, or the next best play — and reference "
        "the relevant go/ resource when helpful.",
        f"Current account: {account.name} ({account.sub_vertical}).",
        f"Furthest adoption stage: {stage_name}.",
        f"Use cases: {len(use_cases)}. Partner-Powered AI: {pp_label}. "
        f"AIM: {account.aim_status}.",
        f"Open blockers: {len(open_blockers)}. Open Genie issues: {len(open_issues)}.",
    ]
    return " ".join(parts)


import re

# Genie appends inline citation links to internal workspace URLs (the genie-room /
# UC-volume explorer), e.g.  \[[1](https://fevm-...databricks.com/genie/rooms/...)\].
# Those only resolve on-network and clutter the answer, so we strip them.
_INTERNAL_HOSTS = ("databricks.com", "databricksapps.com", "azuredatabricks.net")


def _strip_internal_citations(text: str) -> str:
    def _is_internal(url: str) -> bool:
        return any(h in url for h in _INTERNAL_HOSTS)

    # Remove markdown links [label](url) that point at internal hosts, keeping the
    # label only when it's meaningful (not a bare citation number).
    def _link_repl(m: re.Match) -> str:
        label, url = m.group(1), m.group(2)
        if not _is_internal(url):
            return m.group(0)  # keep external links (go/, docs.google, etc.)
        return "" if label.strip().isdigit() else label

    text = re.sub(r"\[([^\]]*)\]\((https?://[^)]+)\)", _link_repl, text)
    # Clean up the leftover citation scaffolding: "\[ \]", "[]", stray " []".
    text = re.sub(r"\\?\[\s*\\?\]", "", text)
    text = re.sub(r"[ \t]*\[\s*\]", "", text)
    # Collapse 3+ newlines and trailing spaces left behind.
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_answer(events: list[dict]) -> GenieAnswerOut:
    """Flatten a Genie Agent Responses stream into text + optional SQL.

    `events` is the list of parsed `data:` JSON objects from the SSE stream. The final
    answer arrives as a `response.output_item.done` whose item is an assistant message
    (`content[].output_text`); any generated SQL shows up as a query/tool item.
    """
    text_parts: list[str] = []
    sql: str | None = None
    conversation_id = ""
    message_id = ""

    for ev in events:
        etype = ev.get("type", "")
        if etype == "response.created":
            resp = ev.get("response", {})
            conversation_id = resp.get("conversation_id", conversation_id)
            message_id = resp.get("id", message_id)
        if etype == "response.output_item.done":
            item = ev.get("item", {})
            if item.get("type") == "message":
                for c in item.get("content", []):
                    txt = c.get("output_text") or c.get("text")
                    if txt:
                        text_parts.append(txt)
            # Some SQL/tool items expose a query on the item.
            q = item.get("query") or (item.get("content") or [{}])[0].get("query")
            if isinstance(q, str) and q:
                sql = q

    text = "\n\n".join(t for t in text_parts if t)
    text = _strip_internal_citations(text) if text else "(no answer)"
    return GenieAnswerOut(
        conversation_id=conversation_id,
        message_id=message_id,
        text=text or "(no answer)",
        sql=sql,
        columns=[],
        rows=[],
    )


def _agent_responses(ws, space_id: str, text: str, conversation_id: str | None):
    """Call the Genie **Agent** Responses API (agent mode) so the assistant can draw on
    attached UC-volume documents as well as the tables. Returns parsed SSE data events.

    Agent mode is a distinct endpoint from the classic conversation API and streams
    Server-Sent Events; we collect the `data:` payloads and let `_extract_answer` flatten
    them."""
    payload: dict = {
        "input": [
            {
                "type": "message",
                "role": "user",
                "content": [{"type": "input_text", "text": text}],
            }
        ],
        "enable_viz": False,
    }
    if conversation_id:
        payload["conversation_id"] = conversation_id

    host = ws.config.host
    headers = ws.config.authenticate() or {}
    headers["Content-Type"] = "application/json"
    url = f"{host}/api/2.0/genie/agents/{space_id}/responses"

    events: list[dict] = []
    with requests.post(url, headers=headers, json=payload, stream=True, timeout=180) as r:
        r.raise_for_status()
        for raw in r.iter_lines():
            if not raw:
                continue
            line = raw.decode("utf-8") if isinstance(raw, bytes) else raw
            if line.startswith("data:"):
                data = line[len("data:"):].strip()
                if data and data != "[DONE]":
                    try:
                        events.append(json.loads(data))
                    except json.JSONDecodeError:
                        pass
    return events


# --------------------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------------------


@router.get(
    "/genie/status",
    response_model=GenieStatusOut,
    operation_id="getGenieStatus",
)
def genie_status(config: Dependencies.Config):
    """Whether the chat assistant is configured (a Space id is set)."""
    return GenieStatusOut(enabled=bool(config.genie_space_id))


@router.post(
    "/genie/ask",
    response_model=GenieAnswerOut,
    operation_id="askGenie",
)
def ask_genie(
    body: GenieAskIn,
    ws: Dependencies.Client,
    session: Dependencies.Session,
    config: Dependencies.Config,
):
    """Ask the Genie assistant a question.

    Starts a new conversation, or continues one when `conversation_id` is supplied.
    When `account_id` is set, the account's context is prepended to the first
    question so answers are tailored to that engagement.
    """
    if not config.genie_space_id:
        # Surface a friendly, actionable message instead of a 500.
        return GenieAnswerOut(
            conversation_id="",
            message_id="",
            text=(
                "The Genie assistant isn't configured yet. Set "
                "GENIE_ADOPTION_TRACKING_GENIE_SPACE_ID to a Genie Space id to enable it."
            ),
            sql=None,
            columns=[],
            rows=[],
        )

    question = body.question.strip()
    space_id = config.genie_space_id

    # Enrich the first turn of a conversation with account context if given.
    if not body.conversation_id and body.account_id:
        ctx = _account_context(session, body.account_id)
        if ctx:
            question = f"{ctx}\n\nQuestion: {question}"

    events = _agent_responses(ws, space_id, question, body.conversation_id)
    return _extract_answer(events)
