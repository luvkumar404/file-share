from pydantic import BaseModel, EmailStr


class UserRead(BaseModel):
    """Safe user data returned by the API."""

    id: int
    email: EmailStr

    model_config = {"from_attributes": True}
