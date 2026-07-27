from fastapi import HTTPException, status


class BaseHTTPException(HTTPException):
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    detail: str = "Unexpected Error"

    def __init__(
        self, status_code: int | None = None, detail: str | None = None
    ) -> None:
        self.status_code: int = status_code or self.status_code
        self.detail: str = detail or self.detail

        super().__init__(status_code=self.status_code, detail=self.detail)


class BadRequest(BaseHTTPException):
    status_code: int = status.HTTP_400_BAD_REQUEST
    detail: str = "Bad Request"


class Unauthorized(BaseHTTPException):
    status_code: int = status.HTTP_401_UNAUTHORIZED
    detail: str = "Unauthorized"


class Forbidden(BaseHTTPException):
    status_code: int = status.HTTP_403_FORBIDDEN
    detail: str = "Forbidden"


class Locked(BaseHTTPException):
    status_code: int = status.HTTP_423_LOCKED
    detail: str = "Locked"


class FileTooLarge(BaseHTTPException):
    status_code: int = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    detail: str = "File Too Large"


class TooManyRequests(BaseHTTPException):
    status_code: int = status.HTTP_429_TOO_MANY_REQUESTS
    detail: str = "Too Many Requests"


class NotFound(BaseHTTPException):
    status_code: int = status.HTTP_404_NOT_FOUND
    detail: str = "Not Found"


class Gone(BaseHTTPException):
    status_code: int = status.HTTP_410_GONE
    detail: str = "Gone"


class FileNotFound(Exception):
    pass


class EmailNotSend(Exception):
    def __init__(self, message: str = "Email was not sent") -> None:
        super().__init__(message)
        self.message = message
