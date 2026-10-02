"""Minimal SMTP sender. No SMTP configured means: log the message instead."""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from .config import settings

logger = logging.getLogger("habitude.mail")


def send_email(to: str, subject: str, body: str) -> None:
    if not settings.smtp_host:
        logger.warning(
            "SMTP not configured — email not sent.\nTo: %s\nSubject: %s\n\n%s", to, subject, body
        )
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from
    message["To"] = to
    message.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_username:
            server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)
