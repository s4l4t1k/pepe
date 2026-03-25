"""
Email sending via SMTP.
Configure via .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
"""
import asyncio
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


async def send_otp_email(to_email: str, code: str) -> bool:
    """Send OTP code via SMTP. Returns True on success."""
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASSWORD", "")
    smtp_from = os.getenv("SMTP_FROM", smtp_user)

    if not all([smtp_host, smtp_user, smtp_pass]):
        logger.error("SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASSWORD required)")
        return False

    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#070e07;font-family:Arial,sans-serif;">
<div style="max-width:480px;margin:40px auto;background:#0c1a0c;border:1px solid #1a3a1a;border-radius:16px;padding:40px;">
  <div style="text-align:center;margin-bottom:28px;">
    <div style="font-size:40px;margin-bottom:8px;">♠</div>
    <h2 style="color:#f59e0b;margin:0;font-size:20px;">Poker Coach AI</h2>
    <p style="color:#4a8a4a;margin:4px 0 0;font-size:13px;">Персональный тренер по покеру</p>
  </div>
  <p style="color:#9ca3af;font-size:14px;margin:0 0 8px;">Твой код для входа:</p>
  <div style="background:#0d1d0d;border:1px solid #243f24;border-radius:12px;padding:24px;text-align:center;margin:16px 0;">
    <span style="font-size:40px;font-weight:bold;color:#f59e0b;letter-spacing:14px;">{code}</span>
  </div>
  <p style="color:#3a6b3a;font-size:12px;text-align:center;margin:16px 0 0;">
    Код действителен <strong style="color:#4a8a4a;">10 минут</strong>. Не передавай его никому.
  </p>
</div>
</body>
</html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Код входа: {code} — Poker Coach AI"
    msg["From"] = smtp_from
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))

    def _send():
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, to_email, msg.as_string())

    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send)
        logger.info(f"OTP email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email to {to_email}: {e}")
        return False
