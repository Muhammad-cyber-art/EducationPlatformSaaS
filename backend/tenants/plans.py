"""Shared subscription prices and stored limits (no access enforcement)."""
PLAN_SETTINGS = {
    "starter": {"price_per_month": 500_000, "max_students": 200, "max_branches": 1},
    "pro": {"price_per_month": 1_500_000, "max_students": 1000, "max_branches": 3},
    "enterprise": {"price_per_month": 3_000_000, "max_students": 10000, "max_branches": 20},
}
