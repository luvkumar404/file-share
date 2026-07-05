from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    """Request body for creating a new account."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserRead(BaseModel):
    """Safe user data returned by the API."""

    id: int
    email: EmailStr

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    """Request body for logging in."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """JWT response returned after a successful login."""

    access_token: str
    token_type: str = "bearer"
