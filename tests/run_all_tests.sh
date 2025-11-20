#!/usr/bin/env bash

source "$(dirname "$0")/test_config.sh"

TOTAL_PASSED=0
TOTAL_FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "RememberMyContext - Complete Test Suite"
echo "========================================"
echo ""
echo "Test Configuration:"
echo "  Base URL: $BASE_URL"
echo "  Test Email Domain: $TEST_EMAIL_DOMAIN"
echo ""

echo "Checking server availability..."
if ! curl -s "$BASE_URL/health" > /dev/null; then
    echo -e "${RED}✗ Server not running on $BASE_URL${NC}"
    echo "Start server with: uvicorn src.main:app --reload --host 127.0.0.1 --port 8000"
    exit 1
fi
echo -e "${GREEN}✓${NC} Server is running"
echo ""

run_test_suite() {
    local test_file=$1
    local test_name=$2
    
    echo "========================================"
    echo "Running: $test_name"
    echo "========================================"
    
    if [ ! -f "$test_file" ]; then
        echo -e "${RED}✗${NC} Test file not found: $test_file"
        ((TOTAL_FAILED++))
        FAILED_TESTS+=("$test_name (file not found)")
        return 1
    fi
    
    chmod +x "$test_file"
    
    if bash "$test_file"; then
        echo -e "${GREEN}✓${NC} $test_name completed successfully"
        ((TOTAL_PASSED++))
        return 0
    else
        local exit_code=$?
        echo -e "${RED}✗${NC} $test_name failed (exit code: $exit_code)"
        ((TOTAL_FAILED++))
        FAILED_TESTS+=("$test_name")
        return 1
    fi
}

echo "========================================"
echo "Starting Test Execution"
echo "========================================"
echo ""

run_test_suite "$(dirname "$0")/test_auth.sh" "Authentication Tests"
echo ""

run_test_suite "$(dirname "$0")/test_email_verification.sh" "Email Verification Tests"
echo ""

run_test_suite "$(dirname "$0")/test_password_reset.sh" "Password Reset Tests"
echo ""

run_test_suite "$(dirname "$0")/test_contexts.sh" "Context Tests"
echo ""

run_test_suite "$(dirname "$0")/test_analytics.sh" "Analytics Tests"
echo ""

run_test_suite "$(dirname "$0")/test_feedback.sh" "Feedback Tests"
echo ""

run_test_suite "$(dirname "$0")/test_onboarding.sh" "Onboarding Tests"
echo ""

run_test_suite "$(dirname "$0")/test_admin.sh" "Admin Tests"
echo ""

echo "========================================"
echo "Final Test Summary"
echo "========================================"
echo -e "${GREEN}Total Test Suites Passed: $TOTAL_PASSED${NC}"
echo -e "${RED}Total Test Suites Failed: $TOTAL_FAILED${NC}"
echo ""

if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
    echo -e "${RED}Failed Test Suites:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo -e "  ${RED}✗${NC} $test"
    done
    echo ""
fi

if [ $TOTAL_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All test suites passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some test suites failed${NC}"
    exit 1
fi

