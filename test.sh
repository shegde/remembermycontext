#!/usr/bin/env bash

BASE_URL="http://127.0.0.1:8000"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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
        echo "$body"
        return 0
    else
        echo -e "${RED}✗${NC} $name (Expected $expected_code, got $status_code)"
        ((FAILED++))
        echo "$body"
        return 1
    fi
}

echo "========================================"
echo "RememberMyContext API Test Suite"
echo "========================================"
echo ""

echo "Testing server availability..."
if ! curl -s "$BASE_URL/health" > /dev/null; then
    echo -e "${RED}✗ Server not running on $BASE_URL${NC}"
    echo "Start server with: ./start.sh"
    exit 1
fi
echo -e "${GREEN}✓${NC} Server is running"
echo ""

echo "--- Basic Endpoints ---"
test_endpoint "Root endpoint" "GET" "/" "" "200"
test_endpoint "Health check" "GET" "/health" "" "200"
echo ""

echo "--- Authentication Tests ---"
RANDOM_EMAIL="test$(date +%s)@example.com"
test_endpoint "Register with valid data" "POST" "/api/v1/auth/register" \
    "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"ValidPass123\"}" "201"

test_endpoint "Register duplicate email" "POST" "/api/v1/auth/register" \
    "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"ValidPass123\"}" "400"

test_endpoint "Register with short password" "POST" "/api/v1/auth/register" \
    "{\"email\":\"short@test.com\",\"password\":\"123\"}" "422"

test_endpoint "Register without letter in password" "POST" "/api/v1/auth/register" \
    "{\"email\":\"noletters@test.com\",\"password\":\"12345678\"}" "422"

test_endpoint "Register without digit in password" "POST" "/api/v1/auth/register" \
    "{\"email\":\"nodigits@test.com\",\"password\":\"PasswordOnly\"}" "422"

test_endpoint "Register invalid email" "POST" "/api/v1/auth/register" \
    "{\"email\":\"notanemail\",\"password\":\"ValidPass123\"}" "422"

test_endpoint "Login with correct credentials" "POST" "/api/v1/auth/login" \
    "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"ValidPass123\"}" "200"

if test_endpoint "Login response" "POST" "/api/v1/auth/login" \
    "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"ValidPass123\"}" "200"; then
    TOKEN=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"ValidPass123\"}" | \
        grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
fi

test_endpoint "Login with wrong password" "POST" "/api/v1/auth/login" \
    "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"WrongPass123\"}" "401"

test_endpoint "Login with non-existent user" "POST" "/api/v1/auth/login" \
    "{\"email\":\"nonexistent@test.com\",\"password\":\"ValidPass123\"}" "401"

echo ""
echo "--- Context Tests (Authenticated) ---"
AUTH_HEADER="Authorization: Bearer $TOKEN"

test_endpoint "Get contexts without auth" "GET" "/api/v1/contexts" "" "403"

test_endpoint "Get contexts with auth" "GET" "/api/v1/contexts" "" "200" "$AUTH_HEADER"

test_endpoint "Create Career context" "POST" "/api/v1/contexts/Career/versions" \
    "{\"text\":\"I am a software engineer with 10 years experience in Python, JavaScript, and cloud architecture.\"}" \
    "201" "$AUTH_HEADER"

test_endpoint "Create Work context" "POST" "/api/v1/contexts/Work/versions" \
    "{\"text\":\"Currently working at Tech Corp as Senior Developer.\"}" \
    "201" "$AUTH_HEADER"

test_endpoint "Create Health context" "POST" "/api/v1/contexts/Health/versions" \
    "{\"text\":\"Regular exercise 3x per week, vegetarian diet.\"}" \
    "201" "$AUTH_HEADER"

test_endpoint "Create Travel context" "POST" "/api/v1/contexts/Travel/versions" \
    "{\"text\":\"Prefer eco-friendly travel, visited 20 countries.\"}" \
    "201" "$AUTH_HEADER"

test_endpoint "Create Custom context" "POST" "/api/v1/contexts/Custom/versions" \
    "{\"text\":\"Custom preferences and settings.\"}" \
    "201" "$AUTH_HEADER"

test_endpoint "Create context with empty text" "POST" "/api/v1/contexts/Career/versions" \
    "{\"text\":\"\"}" "422" "$AUTH_HEADER"

test_endpoint "Create context with whitespace only" "POST" "/api/v1/contexts/Career/versions" \
    "{\"text\":\"   \"}" "422" "$AUTH_HEADER"

test_endpoint "Create context with invalid box name" "POST" "/api/v1/contexts/InvalidBox/versions" \
    "{\"text\":\"Test content\"}" "422" "$AUTH_HEADER"

test_endpoint "Get Career versions" "GET" "/api/v1/contexts/Career/versions" "" "200" "$AUTH_HEADER"

test_endpoint "Get specific version" "GET" "/api/v1/contexts/Career/versions/0" "" "200" "$AUTH_HEADER"

test_endpoint "Get non-existent version" "GET" "/api/v1/contexts/Career/versions/999" "" "404" "$AUTH_HEADER"

if test_endpoint "Get ciphertext" "GET" "/api/v1/contexts/Career/versions/0" "" "200" "$AUTH_HEADER"; then
    CIPHERTEXT=$(curl -s -H "$AUTH_HEADER" "$BASE_URL/api/v1/contexts/Career/versions/0" | \
        grep -o '"ciphertext":"[^"]*' | cut -d'"' -f4)
    
    if [ -n "$CIPHERTEXT" ]; then
        test_endpoint "Decrypt context" "POST" "/api/v1/contexts/decrypt" \
            "{\"ciphertext\":\"$CIPHERTEXT\"}" "200" "$AUTH_HEADER"
    fi
fi

test_endpoint "Mark version as used" "POST" "/api/v1/contexts/Career/versions/0/mark_used" \
    "{\"site\":\"chatgpt.com\"}" "200" "$AUTH_HEADER"

echo ""
echo "--- Analytics Tests ---"
test_endpoint "Create analytics event" "POST" "/api/v1/analytics" \
    "{\"event_type\":\"context_used\",\"metadata\":{\"box\":\"Career\",\"version\":0}}" \
    "201" "$AUTH_HEADER"

test_endpoint "Get analytics events" "GET" "/api/v1/analytics" "" "200" "$AUTH_HEADER"

test_endpoint "Get analytics without auth" "GET" "/api/v1/analytics" "" "403"

echo ""
echo "--- Feedback Tests ---"
test_endpoint "Submit feedback" "POST" "/api/v1/feedback" \
    "{\"type\":\"bug\",\"message\":\"Test feedback message\",\"email\":\"feedback@test.com\"}" \
    "201" "$AUTH_HEADER"

test_endpoint "Submit feedback without email" "POST" "/api/v1/feedback" \
    "{\"type\":\"feature\",\"message\":\"Feature request\"}" \
    "201" "$AUTH_HEADER"

test_endpoint "Submit feedback with invalid type" "POST" "/api/v1/feedback" \
    "{\"type\":\"invalid\",\"message\":\"Test\"}" \
    "422" "$AUTH_HEADER"

echo ""
echo "--- Rate Limiting Tests ---"
echo "Testing registration rate limit (5/min)..."
for i in {1..6}; do
    status=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$BASE_URL/api/v1/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"rate$i@test.com\",\"password\":\"ValidPass123\"}")
    if [ $i -le 5 ]; then
        if [ "$status" != "201" ] && [ "$status" != "400" ]; then
            echo -e "${RED}✗${NC} Request $i failed (HTTP $status)"
            ((FAILED++))
        fi
    else
        if [ "$status" = "429" ]; then
            echo -e "${GREEN}✓${NC} Rate limit working (HTTP 429 on request 6)"
            ((PASSED++))
        else
            echo -e "${RED}✗${NC} Rate limit not working (HTTP $status instead of 429)"
            ((FAILED++))
        fi
    fi
done

echo ""
echo "========================================"
echo "Test Summary"
echo "========================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi

