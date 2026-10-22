import pytest
from datetime import date, timedelta

def test_alexa_launch_request(client):
    payload = {
        "version": "1.0",
        "session": {"new": True, "sessionId": "sess-123"},
        "request": {
            "type": "LaunchRequest",
            "requestId": "req-1"
        }
    }
    res = client.post("/api/alexa", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["version"] == "1.0"
    assert "response" in data
    assert "outputSpeech" in data["response"]
    assert data["response"]["shouldEndSession"] is False
    assert "StudyPilot" in data["response"]["outputSpeech"]["ssml"]

def test_alexa_show_pending_tasks_intent(client):
    payload = {
        "version": "1.0",
        "session": {"new": False, "sessionId": "sess-123"},
        "request": {
            "type": "IntentRequest",
            "requestId": "req-2",
            "intent": {
                "name": "ShowPendingTasksIntent",
                "confirmationStatus": "NONE"
            }
        }
    }
    res = client.post("/api/alexa", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["response"]["shouldEndSession"] is False
    assert "pending" in data["response"]["outputSpeech"]["ssml"].lower() or "task" in data["response"]["outputSpeech"]["ssml"].lower()

def test_alexa_help_intent(client):
    payload = {
        "version": "1.0",
        "session": {"new": False, "sessionId": "sess-123"},
        "request": {
            "type": "IntentRequest",
            "requestId": "req-3",
            "intent": {
                "name": "AMAZON.HelpIntent",
                "confirmationStatus": "NONE"
            }
        }
    }
    res = client.post("/api/alexa", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["response"]["shouldEndSession"] is False
    assert "help" in data["response"]["outputSpeech"]["ssml"].lower() or "ask" in data["response"]["outputSpeech"]["ssml"].lower()

def test_alexa_stop_intent(client):
    payload = {
        "version": "1.0",
        "session": {"new": False, "sessionId": "sess-123"},
        "request": {
            "type": "IntentRequest",
            "requestId": "req-4",
            "intent": {
                "name": "AMAZON.StopIntent",
                "confirmationStatus": "NONE"
            }
        }
    }
    res = client.post("/api/alexa", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["response"]["shouldEndSession"] is True
    assert "goodbye" in data["response"]["outputSpeech"]["ssml"].lower() or "happy studying" in data["response"]["outputSpeech"]["ssml"].lower()
