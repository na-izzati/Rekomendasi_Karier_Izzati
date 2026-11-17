from collections.abc import Mapping
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime


def retry_after_seconds(exc: BaseException) -> float | None:
    candidates = [getattr(exc, "retry_after", None)]
    for response in (exc, getattr(exc, "response", None)):
        headers = getattr(response, "headers", None)
        if isinstance(headers, Mapping):
            candidates.append(
                next(
                    (value for key, value in headers.items()
                     if str(key).casefold() == "retry-after"),
                    None,
                )
            )
    for value in candidates:
        if isinstance(value, bool) or value is None:
            continue
        try:
            return max(0.0, float(value))
        except (TypeError, ValueError):
            try:
                retry_at = parsedate_to_datetime(str(value))
                if retry_at.tzinfo is None:
                    retry_at = retry_at.replace(tzinfo=timezone.utc)
                return max(0.0, (retry_at - datetime.now(timezone.utc)).total_seconds())
            except (TypeError, ValueError, OverflowError):
                continue
    return None


class LLMQuotaExceededError(RuntimeError):
    """The provider rejected a request because its quota is exhausted."""

    def __init__(self, retry_after: float | None = None):
        super().__init__("The configured model quota is exhausted.")
        self.status_code = 429
        self.retry_after = retry_after


class LLMInvalidResponseError(RuntimeError):
    """The provider response was empty, invalid JSON, or not a JSON object."""

    def __init__(self):
        super().__init__("The configured model returned an unusable JSON response.")
