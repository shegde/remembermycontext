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
echo "Password Reset API Tests"
echo "========================================"
echo ""

RESET_EMAIL="${TEST_EMAIL_PREFIX}reset$(date +%s)@${TEST_EMAIL_DOMAIN}"

curl -s -X POST "$BASE_URL/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$RESET_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" > /dev/null

echo "--- Forgot Password Tests ---"
test_endpoint "Forgot password with valid email" "POST" "/api/v1/auth/forgot-password" \
    "{\"email\":\"$RESET_EMAIL\"}" "200"

test_endpoint "Forgot password with non-existent email" "POST" "/api/v1/auth/forgot-password" \
    "{\"email\":\"nonexistent$(date +%s)@test.com\"}" "200"

test_endpoint "Forgot password with invalid email format" "POST" "/api/v1/auth/forgot-password" \
    "{\"email\":\"notanemail\"}" "422"

test_endpoint "Forgot password with empty email" "POST" "/api/v1/auth/forgot-password" \
    "{\"email\":\"\"}" "422"

echo ""
echo "--- Reset Password Tests ---"
test_endpoint "Reset password with invalid token" "POST" "/api/v1/auth/reset-password" \
    "{\"token\":\"invalid-token\",\"new_password\":\"NewPass123\"}" "400"

test_endpoint "Reset password with empty token" "POST" "/api/v1/auth/reset-password" \
    "{\"token\":\"\",\"new_password\":\"NewPass123\"}" "422"

test_endpoint "Reset password with short password" "POST" "/api/v1/auth/reset-password" \
    "{\"token\":\"some-token\",\"new_password\":\"123\"}" "422"

test_endpoint "Reset password with missing fields" "POST" "/api/v1/auth/reset-password" \
    "{\"token\":\"some-token\"}" "422"

echo ""
echo "========================================"
echo "Password Reset Tests Summary"
echo "========================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

exit $FAILED

