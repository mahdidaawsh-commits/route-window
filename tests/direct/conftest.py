import hashlib
import json
import os
from pathlib import Path
import pytest


ROOT = Path(__file__).resolve().parents[2]
REV = "a" * 40
REPO = "example/route-window"
FILES = [
    "001-blue-suspension.md", "002-blue-restoration.md",
    "003-red-advisory.md", "004-red-suspension.md",
]
DOCS = [(ROOT / "bulletins" / name).read_text(encoding="utf-8") for name in FILES]
URLS = [f"https://raw.githubusercontent.com/{REPO}/{REV}/bulletins/{name}" for name in FILES]
DIGESTS = [hashlib.sha256(document.encode()).hexdigest() for document in DOCS]
REPORTS = [
    {"action": "CLOSE", "routes": ["Blue"], "start_hour": 8, "end_hour": 12, "quote": DOCS[0].strip()},
    {"action": "RESTORE", "routes": ["Blue"], "start_hour": 10, "end_hour": 11, "quote": DOCS[1].strip()},
    {"action": "NONE", "routes": [], "start_hour": 0, "end_hour": 0, "quote": ""},
    {"action": "CLOSE", "routes": ["Red"], "start_hour": 9, "end_hour": 11, "quote": DOCS[3].strip()},
]


@pytest.fixture
def direct_deploy(direct_deploy):
    def deploy(*args, **kwargs):
        return direct_deploy(*args, sdk_version="v0.2.16", **kwargs)
    return deploy


@pytest.fixture(autouse=True)
def windows_stdin_sharing_workaround(monkeypatch):
    if os.name != "nt":
        yield
        return
    from gltest.direct import loader
    original = loader._inject_message_to_fd0
    deferred = []

    def inject(vm):
        try:
            original(vm)
        except PermissionError as error:
            if error.winerror != 32:
                raise
            deferred.append(Path(error.filename))

    monkeypatch.setattr(loader, "_inject_message_to_fd0", inject)
    yield
    for file in deferred:
        try:
            file.unlink(missing_ok=True)
        except PermissionError:
            pass


def mock_issue(vm, index, report=None, verdict=None, document=None):
    vm.clear_mocks()
    vm.mock_web(URLS[index].replace(".", r"\."), {"status": 200, "body": document if document is not None else DOCS[index]})
    vm.mock_llm(r".*ROUTEWINDOW-EXTRACT.*", json.dumps(report if report is not None else REPORTS[index]))
    vm.mock_llm(r".*ROUTEWINDOW-VERIFY.*", json.dumps(verdict if verdict is not None else {
        "action_ok": True, "routes_ok": True, "start_ok": True,
        "end_ok": True, "quote_ok": True, "absence_ok": True,
    }))


@pytest.fixture
def window(direct_deploy):
    return direct_deploy(str(ROOT / "contracts/route_window.py"), REPO, "2026-10-03T00:00:00Z", 48, json.dumps(["Blue", "Red"]))
