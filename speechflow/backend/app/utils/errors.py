"""
Custom exception types for SpeechFlow.
"""
from fastapi import HTTPException, status


class SpeechFlowException(Exception):
    """Base application exception."""
    pass


class SessionNotFoundError(SpeechFlowException):
    pass


class SessionExpiredError(SpeechFlowException):
    pass


class TranscriptionNotFoundError(SpeechFlowException):
    pass


class PermissionDeniedError(SpeechFlowException):
    pass


class GeminiError(SpeechFlowException):
    pass


class GeminiQuotaError(GeminiError):
    pass


# --- FastAPI HTTP exception factories ---

def http_not_found(message: str = "Resource not found.") -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)


def http_forbidden(message: str = "Access denied.") -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message)


def http_unauthorized(message: str = "Session expired or invalid.") -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=message)


def http_bad_request(message: str = "Invalid request.") -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)


def http_internal_error(message: str = "An internal error occurred.") -> HTTPException:
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=message)
