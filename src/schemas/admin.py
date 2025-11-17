from pydantic import BaseModel, Field


class AdminLogin(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=100)


class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

