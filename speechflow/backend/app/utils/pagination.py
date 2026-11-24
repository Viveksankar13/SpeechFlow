"""
Pagination utilities.
"""
from typing import TypeVar, Generic, Sequence
from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class PaginatedResponse(BaseModel, Generic[T]):
    items: Sequence[T]
    total: int
    page: int
    page_size: int
    pages: int

    @classmethod
    def create(
        cls,
        items: Sequence[T],
        total: int,
        params: PaginationParams,
    ) -> "PaginatedResponse[T]":
        import math
        pages = max(1, math.ceil(total / params.page_size)) if total > 0 else 1
        return cls(
            items=items,
            total=total,
            page=params.page,
            page_size=params.page_size,
            pages=pages,
        )
