import copy
import json
import pytest
from conftest import ROOT, REPO, URLS, DIGESTS, DOCS, REPORTS, mock_issue


def ingest(window, direct_vm, issue):
    mock_issue(direct_vm, issue)
    window.ingest_bulletin(URLS[issue], DIGESTS[issue])


def test_closure_restoration_advisory_and_second_route(window, direct_vm):
    ingest(window, direct_vm, 0)
    assert window.get_schedule()["closed_intervals"] == {"Blue": [[8, 12]], "Red": []}
    ingest(window, direct_vm, 1)
    assert window.get_schedule()["closed_intervals"]["Blue"] == [[8, 10], [11, 12]]
    ingest(window, direct_vm, 2)
    assert window.get_schedule()["closed_intervals"]["Red"] == []
    ingest(window, direct_vm, 3)
    assert window.get_schedule()["closed_intervals"] == {"Blue": [[8, 10], [11, 12]], "Red": [[9, 11]]}
    assert window.get_schedule()["bulletin_count"] == 4
    assert window.get_bulletin(4)["report"]["routes"] == ["Red"]


def test_reject_wrong_source_and_order(window, direct_vm):
    with direct_vm.expect_revert("fixed repository"):
        window.ingest_bulletin(URLS[0].replace(REPO, "attacker/route-window"), DIGESTS[0])
    with direct_vm.expect_revert("next numbered"):
        window.ingest_bulletin(URLS[1], DIGESTS[1])
    with direct_vm.expect_revert("next numbered"):
        window.ingest_bulletin(URLS[0].replace("/" + "a" * 40 + "/", "/main/"), DIGESTS[0])
    assert window.get_schedule()["bulletin_count"] == 0


def test_hash_mismatch_rolls_back(window, direct_vm):
    mock_issue(direct_vm, 0, document=DOCS[0] + "changed")
    with direct_vm.expect_revert("SHA-256 mismatch"):
        window.ingest_bulletin(URLS[0], DIGESTS[0])
    assert window.get_schedule()["bulletin_count"] == 0


def test_fabricated_quote_rolls_back(window, direct_vm):
    forged = copy.deepcopy(REPORTS[0])
    forged["quote"] = "Fabricated route suspension statement."
    mock_issue(direct_vm, 0, report=forged)
    with direct_vm.expect_revert("Unsupported window"):
        window.ingest_bulletin(URLS[0], DIGESTS[0])
    assert window.get_schedule()["bulletin_count"] == 0


def test_validator_rechecks_all_dimensions(window, direct_vm):
    ingest(window, direct_vm, 0)
    assert direct_vm.run_validator() is True
    bad = {"action_ok": True, "routes_ok": False, "start_ok": True, "end_ok": True, "quote_ok": True, "absence_ok": True}
    mock_issue(direct_vm, 0, verdict=bad)
    assert direct_vm.run_validator() is False


def test_validator_rejects_changed_bytes(window, direct_vm):
    ingest(window, direct_vm, 0)
    mock_issue(direct_vm, 0, document=DOCS[0] + " changed")
    assert direct_vm.run_validator() is False


def test_validator_rejects_wrong_time(window, direct_vm):
    ingest(window, direct_vm, 0)
    forged = copy.deepcopy(REPORTS[0])
    forged["start_hour"] = 9
    bad = {"action_ok": True, "routes_ok": True, "start_ok": False, "end_ok": True, "quote_ok": True, "absence_ok": True}
    mock_issue(direct_vm, 0, verdict=bad)
    assert direct_vm.run_validator(leader_result={"report": forged, "source_sha256": DIGESTS[0]}) is False


@pytest.mark.parametrize("routes", [[], ["Blue", "Blue"], ["Blue", 1]])
def test_reject_bad_routes(direct_deploy, direct_vm, routes):
    with direct_vm.expect_revert():
        direct_deploy(str(ROOT / "contracts/route_window.py"), REPO, "2026-10-03T00:00:00Z", 48, json.dumps(routes))
