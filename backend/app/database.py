from datetime import datetime, date, timedelta
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# SQLite specific connect args to allow multithreading
connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

# Enable SQLite foreign key enforcement
if "sqlite" in settings.DATABASE_URL:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    # Import models so Base metadata is populated
    from app.models.task import Task
    from app.models.plan import StudyPlan
    Base.metadata.create_all(bind=engine)
    
    # Check if empty, seed initial sample tasks for first run experience
    db = SessionLocal()
    try:
        count = db.query(Task).count()
        if count == 0:
            today = date.today()
            sample_tasks = [
                Task(
                    title="Binary Search Trees & Balancing",
                    subject="Data Structures & Algorithms",
                    topic="Binary Search Trees",
                    date=today.strftime("%Y-%m-%d"),
                    start_time="10:00",
                    duration=90,
                    priority="high",
                    is_completed=True,
                    description="Review AVL rotations and Red-Black tree insertion invariants."
                ),
                Task(
                    title="TCP vs UDP & Congestion Control",
                    subject="Computer Networks",
                    topic="Transport Layer",
                    date=today.strftime("%Y-%m-%d"),
                    start_time="14:00",
                    duration=60,
                    priority="medium",
                    is_completed=False,
                    description="Understand 3-way handshake, SYN flood protection, and AIMD."
                ),
                Task(
                    title="Virtual Memory & Paging Mechanisms",
                    subject="Operating Systems",
                    topic="Memory Management",
                    date=(today + timedelta(days=1)).strftime("%Y-%m-%d"),
                    start_time="11:00",
                    duration=75,
                    priority="high",
                    is_completed=False,
                    description="Multi-level page tables, TLB miss handling, and page fault traps."
                ),
                Task(
                    title="Graph Traversal (BFS & DFS) Problems",
                    subject="Data Structures & Algorithms",
                    topic="Graph Algorithms",
                    date=(today + timedelta(days=2)).strftime("%Y-%m-%d"),
                    start_time="09:30",
                    duration=90,
                    priority="high",
                    is_completed=False,
                    description="Solve Topo Sort, cycle detection in directed graphs, and bipartite check."
                ),
                Task(
                    title="SQL Joins and Normalization (1NF to BCNF)",
                    subject="Database Systems",
                    topic="Relational Schema Design",
                    date=(today + timedelta(days=3)).strftime("%Y-%m-%d"),
                    start_time="15:00",
                    duration=60,
                    priority="medium",
                    is_completed=False,
                    description="Practice multi-table joins, subqueries, and functional dependencies."
                ),
            ]
            db.add_all(sample_tasks)
            db.commit()
    finally:
        db.close()
