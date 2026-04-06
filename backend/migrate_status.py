from sqlmodel import Session, select
from database import engine
from models import TournamentEvent

def migrate_status():
    with Session(engine) as session:
        statement = select(TournamentEvent).where(TournamentEvent.status == "upcoming")
        results = session.exec(statement).all()
        for t in results:
            t.status = "registering"
            session.add(t)
        session.commit()
        print(f"Migrated {len(results)} tournaments from 'upcoming' to 'registering'.")

if __name__ == "__main__":
    migrate_status()
