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
    # Same design language as the workshop: Carbon dark, the one blue, zero
    # radius, and the mark served from the site (mail clients strip inline SVG).
    msg.add_alternative(
        f"""<html><body style="margin:0;padding:0;background:#161616">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#161616;padding:36px 16px">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0"
           style="max-width:560px;width:100%;background:#262626;border:1px solid #393939">
      <tr><td style="padding:22px 28px;border-bottom:1px solid #393939">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td><img src="{PUBLIC_URL}/logo-email.png" width="34" height="34" alt="COBOL Explorer"
                   style="display:block;border:0" /></td>
          <td style="padding-left:12px;font:600 15px 'IBM Plex Sans',Helvetica,Arial,sans-serif;color:#f4f4f4">
            COBOL&nbsp;Explorer</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:30px 28px 8px;font:400 15px/1.65 'IBM Plex Sans',Helvetica,Arial,sans-serif;color:#f4f4f4">
        Hi {display},
      </td></tr>
      <tr><td style="padding:6px 28px 22px;font:400 14px/1.65 'IBM Plex Sans',Helvetica,Arial,sans-serif;color:#c6c6c6">
        Confirm your e-mail address to activate your COBOL Explorer account.
      </td></tr>
      <tr><td style="padding:0 28px 26px">
        <a href="{link}" style="display:inline-block;background:#0f62fe;color:#ffffff;
           font:600 14px 'IBM Plex Sans',Helvetica,Arial,sans-serif;text-decoration:none;
           padding:13px 24px">Confirm my address</a>
      </td></tr>
      <tr><td style="padding:0 28px 26px;font:400 12px/1.6 'IBM Plex Sans',Helvetica,Arial,sans-serif;color:#8d8d8d">
        Or paste this link into your browser:<br />
        <a href="{link}" style="color:#78a9ff;word-break:break-all">{link}</a>
      </td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid #393939;
                     font:400 12px/1.6 'IBM Plex Sans',Helvetica,Arial,sans-serif;color:#8d8d8d">
        The link is valid for 24 hours. If you did not create this account, ignore this
        message: nothing was activated.<br /><br />
        COBOL Explorer · the AI workshop for mainframe estates<br />
        <a href="{PUBLIC_URL}" style="color:#78a9ff">{PUBLIC_URL.replace("https://","")}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
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
