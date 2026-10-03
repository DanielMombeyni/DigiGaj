from app.services.sms_templates import build_pattern_parameters, resolve_context_value


def test_otp_alias_fills_pattern_param_names():
    context = {"code": "654321", "phone": "09120000000"}
    params = build_pattern_parameters(["otp", "phone"], context, event="login_otp")
    assert params["otp"] == "654321"
    assert params["phone"] == "09120000000"


def test_single_pattern_param_gets_code_for_login():
    context = {"code": "111222"}
    params = build_pattern_parameters(["verificationCode"], context, event="login_otp")
    assert params["verificationCode"] == "111222"


def test_order_aliases_resolve():
    context = {"order_id": "GS-9", "status": "ارسال‌شده", "name": "علی"}
    assert resolve_context_value("orderId", context) == "GS-9"
    assert resolve_context_value("order_status", context) == "ارسال‌شده"
    params = build_pattern_parameters(
        ["orderId", "status", "fullname"],
        context,
        event="order_status_changed",
    )
    assert params["orderId"] == "GS-9"
    assert params["status"] == "ارسال‌شده"
    assert params["fullname"] == "علی"
