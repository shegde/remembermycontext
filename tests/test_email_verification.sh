#!/usr/bin/env bash

source "$(dirname "$0")/test_config.sh"

PASSED=0
FAILED=0

test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_code=$5
    local headers=$6
    
    if [ -n "$headers" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "$headers" \
            -d "$data" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" = "$expected_code" ]; then
        echo -e "${GREEN}✓${NC} $name (HTTP $status_code)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $name (Expected $expected_code, got $status_code)"
        ((FAILED++))
        return 1
    fi
}

echo "========================================"
echo "Email Verification API Tests"
echo "========================================"
echo ""

VERIFY_EMAIL="${TEST_EMAIL_PREFIX}verify$(date +%s)@${TEST_EMAIL_DOMAIN}"

curl -s -X POST "$BASE_URL/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$VERIFY_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" > /dev/null

echo "--- Resend Verification Tests ---"
test_endpoint "Resend verification for non-existent email" "POST" "/api/v1/auth/resend-verification" \
    "{\"email\":\"nonexistent$(date +%s)@test.com\"}" "200"

test_endpoint "Resend verification for existing email" "POST" "/api/v1/auth/resend-verification" \
    "{\"email\":\"$VERIFY_EMAIL\"}" "200"

test_endpoint "Resend verification with invalid email format" "POST" "/api/v1/auth/resend-verification" \
    "{\"email\":\"notanemail\"}" "422"

test_endpoint "Resend verification with empty email" "POST" "/api/v1/auth/resend-verification" \
    "{\"email\":\"\"}" "422"

echo ""
echo "--- Verify Email Tests ---"
test_endpoint "Verify email with invalid token" "POST" "/api/v1/auth/verify-email" \
    "{\"token\":\"invalid-token-12345\"}" "400"

test_endpoint "Verify email with empty token" "POST" "/api/v1/auth/verify-email" \
    "{\"token\":\"\"}" "422"

test_endpoint "Verify email with missing token field" "POST" "/api/v1/auth/verify-email" \
    "{}" "422"

echo ""
echo "========================================"
echo "Email Verification Tests Summary"
echo "========================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

exit $FAILED

