from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_subject
from app.models import User

oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def current_user(token: str | None = Depends(oauth2), db: Session = Depends(get_db)) -> User:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    try: user_id = int(decode_subject(token))
    except ValueError: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    user = db.get(User, user_id)
    if not user: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    return user

def verified_user(user: User = Depends(current_user)) -> User:
    if not user.age_verified: raise HTTPException(status_code=403, detail="Age verification required")
    return user
