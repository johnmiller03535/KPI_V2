from pydantic import BaseModel
from typing import Optional
from app.models.user import UserRole

class LoginRequest(BaseModel):
    login: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class UserResponse(BaseModel):
    redmine_id: str
    login: str
    firstname: str
    lastname: str
    full_name: str
    email: Optional[str]
    role: UserRole
    department: Optional[str]
    position_id: Optional[str]

    class Config:
        from_attributes = True

class RefreshRequest(BaseModel):
    refresh_token: str

TokenResponse.model_rebuild()
