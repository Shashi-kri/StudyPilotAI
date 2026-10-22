# StudyPilot AI 🎓✈️

> **Intelligent AI-Powered Study Planning and Exam Preparation Companion**  
> *Developed for Amazon Developer Hackathon 2026 (Alexa+ Track MVP)*

StudyPilot AI is a modern full-stack web application designed to help students optimize their exam prep and daily learning routine. It combines smart schedule generation, dynamic priority weighting, progress tracking, and an interactive Alexa+-style conversational study assistant.

---

## ✨ Features

- 📊 **Dynamic Dashboard**: Real-time progress analytics, study streak tracker, weekly task distribution charts, and upcoming study session timelines.
- 🗓️ **Adaptive Study Planner**: Input your exam dates, daily available hours, subjects, and topic difficulties. The scheduling engine generates an optimal personalized calendar.
- ✅ **Task Management Board**: Filter tasks by day (Today, Upcoming, All, Completed), update status, adjust duration and priorities, and search instantly.
- 📅 **7-Day Weekly Grid**: Calendar agenda view visualizing daily allocated study slots and completion statuses.
- 🎙️ **Alexa+ Conversational Assistant**: Built-in voice/chat assistant capable of answering schedule queries, summarizing pending tasks, creating new study plans, and offering motivation.
- 🔄 **Multi-Provider AI Architecture**: Seamlessly switch between **Offline Mock Mode** (100% deterministic, no API keys needed), **Google Gemini**, **OpenAI**, or **Anthropic**.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts & Visualizations**: [Recharts](https://recharts.org/)

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+)
- **ORM & Database**: [SQLAlchemy](https://www.sqlalchemy.org/) with SQLite
- **Validation**: [Pydantic v2](https://docs.pydantic.dev/)
- **Testing**: [pytest](https://docs.pytest.org/)

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+

### 1. Clone the Repository
```bash
git clone https://github.com/Shashi-kri/StudyPilotAI.git
cd StudyPilotAI
```

### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows (cmd/PowerShell):
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run backend development server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The FastAPI backend will start at `http://127.0.0.1:8000`.  
Swagger documentation is accessible at `http://127.0.0.1:8000/docs`.

### 3. Frontend Setup
In a new terminal window:
```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
The frontend will start at `http://localhost:5173`.

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` in the root or set in backend:
```env
PROJECT_NAME="StudyPilot AI"
ENVIRONMENT="development"
DEBUG=True
PORT=8000
HOST="127.0.0.1"
DATABASE_URL="sqlite:///./studypilot.db"

# LLM Provider: 'mock' (default, works offline), 'gemini', 'openai', or 'anthropic'
AI_PROVIDER="mock"
GEMINI_API_KEY=""
OPENAI_API_KEY=""
```

---

## 🧪 Testing

Run backend test suite:
```bash
cd backend
.\venv\Scripts\python -m pytest tests
```

Build frontend production bundle:
```bash
cd frontend
npm run build
```

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
