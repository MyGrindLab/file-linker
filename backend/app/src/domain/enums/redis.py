from enum import Enum


class RedisKey(str, Enum):
    check = "check:{name}"
    check_verify = "check_verify:{_id}"
