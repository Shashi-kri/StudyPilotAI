import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db

# In-memory SQLite with StaticPool so all connections share the same memory DB
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "healthy"
    assert "mock_mode" in data

def test_task_crud_lifecycle():
    today = date.today().strftime("%Y-%m-%d")
    
    # 1. Create task
    new_task = {
        "title": "Learn Graph Algorithms",
        "subject": "Data Structures",
        "topic": "Graph Algorithms",
        "date": today,
        "start_time": "10:00",
        "duration": 90,
        "priority": "high",
        "is_completed": False,
        "description": "Learn Dijkstra and Prim algorithms."
    }
    create_res = client.post("/api/tasks", json=new_task)
    assert create_res.status_code == 201
    task_data = create_res.json()
    task_id = task_data["id"]
    assert task_data["title"] == "Learn Graph Algorithms"
    assert task_data["is_completed"] is False

    # 2. Get task by ID
    get_res = client.get(f"/api/tasks/{task_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == task_id

    # 3. List tasks with filter
    list_res = client.get("/api/tasks?filter_type=today")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 4. Toggle completion
    toggle_res = client.post(f"/api/tasks/{task_id}/toggle")
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_completed"] is True

    # 5. Update task
    update_res = client.patch(f"/api/tasks/{task_id}", json={"duration": 120, "priority": "medium"})
    assert update_res.status_code == 200
    assert update_res.json()["duration"] == 120
    assert update_res.json()["priority"] == "medium"

    # 6. Delete task
    del_res = client.delete(f"/api/tasks/{task_id}")
    assert del_res.status_code == 200

    # Verify not found after delete
    get_after_del = client.get(f"/api/tasks/{task_id}")
    assert get_after_del.status_code == 404

def test_study_plan_generation_and_saving():
    today = date.today()
    exam_date = (today + timedelta(days=10)).strftime("%Y-%m-%d")

    plan_req = {
        "student_name": "Alex",
        "subjects": [
            {
                "name": "Database Systems",
                "difficulty": "medium",
                "topics": ["SQL Normalization", "B+ Trees", "ACID Transactions"]
            }
        ],
        "exam_date": exam_date,
        "daily_hours": 2.0,
        "preferred_days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "topic_priority": {"ACID Transactions": "high"},
        "break_preferences": "15 min break every hour",
        "is_revision_prioritized": True
    }

    # Generate plan
    gen_res = client.post("/api/plans/generate", json=plan_req)
    assert gen_res.status_code == 200
    plan_out = gen_res.json()
    assert plan_out["total_tasks_count"] > 0
    assert len(plan_out["tasks"]) > 0

    # Save plan
    save_req = {
        "title": plan_out["plan_title"],
        "student_name": "Alex",
        "exam_date": exam_date,
        "daily_hours": 2.0,
        "preferred_days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "subject_difficulty": {"Database Systems": "medium"},
        "topic_priority": {"ACID Transactions": "high"},
        "tasks": plan_out["tasks"]
    }
    save_res = client.post("/api/plans", json=save_req)
    assert save_res.status_code == 201
    saved_plan = save_res.json()
    assert saved_plan["id"] is not None

    # Verify tasks were persisted to tasks table
    tasks_res = client.get("/api/tasks")
    assert tasks_res.status_code == 200
    tasks = tasks_res.json()
    assert len(tasks) == plan_out["total_tasks_count"]

    # Verify dashboard calculates from saved records
    dash_res = client.get("/api/dashboard")
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["total_tasks"] == len(tasks)
    assert dash_data["exam_countdown_days"] is not None

def test_conversational_assistant():
    # Chat query for pending tasks
    chat_res = client.post("/api/assistant/chat", json={"message": "Show me my pending tasks"})
    assert chat_res.status_code == 200
    data = chat_res.json()
    assert "reply" in data
    assert data["generation_mode"] in ["mock", "llm"]

    # Chat query for plan generation
    chat_plan = client.post("/api/assistant/chat", json={"message": "Create a 7-day DSA revision plan"})
    assert chat_plan.status_code == 200
    plan_data = chat_plan.json()
    assert plan_data["card_type"] == "plan_preview"
    assert "tasks" in plan_data["card_data"]
