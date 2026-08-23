"""Transactional e-mail over plain SMTP - no third-party API, no vendor lock-in.

The workshop only ever sends one kind of message: "confirm your address". That does
not justify a service dependency, so it goes out through whatever SMTP relay the
deployment already has (the domain's own mailbox, in our case IONOS).

Configuration - all optional. With ``COBOL_EXPLORER_SMTP_HOST`` unset the mailer is
"not ready", and the sign-up flow degrades honestly: accounts are created verified
and the UI says verification is disabled, rather than silently swallowing an e-mail
nobody will ever receive.

    COBOL_EXPLORER_SMTP_HOST=smtp.ionos.fr
    COBOL_EXPLORER_SMTP_PORT=587          # 587 STARTTLS (default) · 465 implicit TLS
    COBOL_EXPLORER_SMTP_USER=noreply@cobol-explorer.fr
    COBOL_EXPLORER_SMTP_PASSWORD=...
    COBOL_EXPLORER_SMTP_FROM="COBOL Explorer <noreply@cobol-explorer.fr>"
    COBOL_EXPLORER_PUBLIC_URL=https://cobol-explorer.fr
"""
from __future__ import annotations

import os
import smtplib
import ssl
from email.message import EmailMessage

HOST = os.environ.get("COBOL_EXPLORER_SMTP_HOST", "")
PORT = int(os.environ.get("COBOL_EXPLORER_SMTP_PORT", "587"))
USER = os.environ.get("COBOL_EXPLORER_SMTP_USER", "")
PASSWORD = os.environ.get("COBOL_EXPLORER_SMTP_PASSWORD", "")
SENDER = os.environ.get("COBOL_EXPLORER_SMTP_FROM") or USER or "noreply@localhost"
PUBLIC_URL = os.environ.get("COBOL_EXPLORER_PUBLIC_URL", "http://127.0.0.1:8000").rstrip("/")


def ready() -> bool:
    """True when a relay is configured - the only thing the API should branch on."""
    return bool(HOST)


def verification_link(token: str) -> str:
    return f"{PUBLIC_URL}/api/verify?token={token}"


def send_verification(to: str, display: str, token: str) -> bool:
    """Send the confirmation e-mail. Returns False if it could not be delivered.

    Never raises: a relay hiccup must not turn a sign-up into a 500. The caller
    reports the failure to the user and the account stays unverified, so the link
    can be re-sent later.
    """
    link = verification_link(token)
    msg = EmailMessage()
    msg["Subject"] = "Confirm your COBOL Explorer account"
    msg["From"] = SENDER
    msg["To"] = to
    msg.set_content(
        f"""Hi {display},

Confirm your e-mail address to activate your COBOL Explorer account:

    {link}

The link is valid for 24 hours. If you did not create this account, ignore this
message - nothing was activated.

COBOL Explorer · the AI workshop for mainframe estates
{PUBLIC_URL}
"""
    )
    msg.add_alternative(
        f"""<html><body style="font:400 15px/1.6 -apple-system,Segoe UI,sans-serif;color:#1c1e22">
  <p>Hi {display},</p>
  <p>Confirm your e-mail address to activate your COBOL Explorer account:</p>
  <p><a href="{link}" style="display:inline-block;background:#ffb020;color:#191a1d;font-weight:600;
     text-decoration:none;padding:11px 20px;border-radius:6px">Confirm my address</a></p>
  <p style="color:#596069;font-size:13px">The link is valid for 24 hours. If you did not create this
     account, ignore this message: nothing was activated.</p>
  <p style="color:#596069;font-size:13px">COBOL Explorer · the AI workshop for mainframe estates<br />
     <a href="{PUBLIC_URL}" style="color:#b57d18">{PUBLIC_URL}</a></p>
</body></html>""",
        subtype="html",
    )

    try:
        if PORT == 465:
            with smtplib.SMTP_SSL(HOST, PORT, context=ssl.create_default_context(), timeout=15) as s:
                if USER:
                    s.login(USER, PASSWORD)
                s.send_message(msg)
        else:
            with smtplib.SMTP(HOST, PORT, timeout=15) as s:
                s.starttls(context=ssl.create_default_context())
                if USER:
                    s.login(USER, PASSWORD)
                s.send_message(msg)
        return True
    except Exception:
        return False
