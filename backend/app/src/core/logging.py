from typing import Any

LOG_CONFIG: dict[str, Any] = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "()": "uvicorn.logging.DefaultFormatter",
            "fmt": "[%(asctime)s] %(levelname)s: %(name)s %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
            "use_colors": True,
        },
        "simple": {
            "format": "[{asctime}] {levelname}: {name} {message}",
            "datefmt": "%Y-%m-%d %H:%M:%S",
            "style": "{",
        },
    },
    "handlers": {
        "default": {
            "formatter": "default",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stderr",
        },
        "console": {
            "level": "INFO",
            "class": "logging.StreamHandler",
            "formatter": "simple",
        },
    },
    "loggers": {
        "uvicorn": {"handlers": ["default"], "level": "DEBUG", "propagate": True},
        "uvicorn.error": {"handlers": ["default"], "level": "INFO", "propagate": False},
        "uvicorn.access": {
            "handlers": ["default"],
            "level": "INFO",
            "propagate": False,
        },
        "httpx": {
            "handlers": ["default"],
            "level": "WARNING",
            "propagate": False,
        },
        "EXCEPTION_HANDLER": {
            "handlers": ["default"],
            "level": "WARNING",
            "propagate": False,
        },
        "EMAIL_SENDER": {
            "handlers": ["default"],
            "level": "INFO",
            "propagate": False,
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
}
